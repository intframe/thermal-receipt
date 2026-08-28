// ThermalReceipt: a scroll-driven thermal receipt printer UI component for React.
// Scroll (or a controlled `progress` prop) feeds the paper out of the printer in
// 3px stepper-motor increments; each line "develops" from pale to ink as it clears
// the slot, a stamp slams down near the end, and the receipt tears off at the top
// of the range. Phases are exposed via a `data-phase` attribute for styling hooks.
import { useEffect, useRef, type ReactNode } from "react";
import s from "./thermal-receipt.module.css";

/* Progress breakpoints for each phase of the animation (0..1). */
const PRINT_START = 0.055;
const PRINT_END = 0.76;
const STAMP_AT = 0.8;
const TEAR_AT = 0.87;
const OUT_AT = 0.905;

/* Paper advances in fixed pixel steps to mimic a stepper-motor feed. */
const FEED_STEP_PX = 3;

type Phase = "idle" | "print" | "stamp" | "tear" | "out";

const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** One printable line of the receipt, tagged by layout kind. */
export type ReceiptLine =
  /** Large centered wordmark. */
  | { kind: "logo"; text: string }
  /** Small centered caption line. */
  | { kind: "center"; text: string }
  /** Dashed horizontal divider. */
  | { kind: "rule" }
  /** Label ... value row with a dotted leader. */
  | { kind: "kv"; label: string; value: string }
  /** Bold statement line; `em` renders as an inverted (ink-box) suffix. */
  | { kind: "big"; text: string; em?: string }
  /** Small indented footnote line. */
  | { kind: "sub"; text: string }
  /** Total row. The stamp (if any) is anchored to this block. `note` prints under it. */
  | { kind: "total"; label: string; value: string; note?: string }
  /** Decorative barcode block. */
  | { kind: "barcode" };

/** Rubber stamp that slams onto the total block during the "stamp" phase. */
export interface ThermalReceiptStamp {
  title: string;
  subtitle?: string;
}

/** Override the printer's LCD status text per phase ("print" shows a live line counter). */
export interface ThermalReceiptLcd {
  idle?: string;
  stamp?: string;
  tear?: string;
  out?: string;
}

export interface ThermalReceiptProps {
  /** Receipt content, printed top to bottom. */
  lines: ReceiptLine[];
  /** Optional stamp, anchored to the `total` line. */
  stamp?: ThermalReceiptStamp;
  /**
   * Controlled mode: animation progress from 0 to 1.
   * Omit it entirely for self-driven scroll mode, where the component renders a
   * tall scroll section and computes progress from its own position in the viewport.
   */
  progress?: number;
  /** Self-driven mode only: total height of the scroll section. Default "390vh". */
  scrollLength?: string;
  /** Paper tilts slightly toward the cursor (fine pointers only). Default true. */
  cursorTilt?: boolean;
  /** Small label printed on the printer body. */
  printerLabel?: string;
  /** LCD status text overrides. */
  lcd?: ThermalReceiptLcd;
  /** Optional content revealed in the stage after the receipt tears away. */
  outro?: ReactNode;
  className?: string;
}

export default function ThermalReceipt({
  lines,
  stamp,
  progress,
  scrollLength = "390vh",
  cursorTilt = true,
  printerLabel = "THERMAL · TR-26",
  lcd,
  outro,
  className,
}: ThermalReceiptProps) {
  const controlled = progress !== undefined;
  const secRef = useRef<HTMLElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const lcdRef = useRef<HTMLSpanElement>(null);

  /* Latest-value refs so the rAF loop reads fresh props without restarting. */
  const progressRef = useRef(0);
  if (controlled) progressRef.current = clamp01(progress);
  const lcdTextRef = useRef<Record<Exclude<Phase, "print">, string>>({
    idle: "",
    stamp: "",
    tear: "",
    out: "",
  });
  lcdTextRef.current = {
    idle: lcd?.idle ?? "IDLE · READY",
    stamp: lcd?.stamp ?? "SETTLED · 0.00",
    tear: lcd?.tear ?? "TEAR OFF",
    out: lcd?.out ?? "THANK YOU",
  };

  useEffect(() => {
    const sec = secRef.current;
    const paper = paperRef.current;
    const inner = innerRef.current;
    if (!sec || !paper || !inner) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rows = Array.from(inner.children) as HTMLElement[];
    let bottoms: number[] = [];
    let totalH = 0;
    const measure = () => {
      bottoms = rows.map((el) => el.offsetTop + el.offsetHeight);
      totalH = inner.offsetHeight;
    };
    measure();
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});

    /* Re-measure on any layout change, not only a window resize. A sidebar opening
       beside the receipt re-wraps the lines and grows `inner.offsetHeight` while the
       window stays put, which would otherwise leave `bottoms` and `totalH` stale and
       stop the paper short of the last line. */
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(inner);
    } else {
      addEventListener("resize", measure);
    }

    let smooth = reduced ? 1 : 0;
    let lastPhase = "";
    let lastK = -1;
    let visible = false;
    let raf = 0;
    let t0 = performance.now();

    /* Spring-damped paper tilt following the cursor (fine pointers only). */
    const fine = cursorTilt && !matchMedia("(pointer:coarse)").matches;
    let mx = 0;
    let mxS = 0;
    const onMove = (e: PointerEvent) => {
      mx = (e.clientX / innerWidth - 0.5) * 2;
    };
    if (fine) addEventListener("pointermove", onMove, { passive: true });

    /* Skip all work while the component is off-screen. */
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => (visible = en.isIntersecting)),
      { threshold: 0.01 },
    );
    io.observe(sec);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - t0) / 1000, 0.05);
      t0 = now;
      if (!visible) return;

      /* Self-driven mode: derive progress from the section's viewport position. */
      if (!controlled) {
        const rect = sec.getBoundingClientRect();
        const track = rect.height - innerHeight;
        progressRef.current = track > 0 ? clamp01(-rect.top / track) : 0;
      }

      const want = reduced ? 1 : progressRef.current;
      smooth += (want - smooth) * (reduced ? 1 : 1 - Math.exp(-dt * 4.2));
      const p = smooth;

      if (fine && tiltRef.current) {
        const tearing = p >= TEAR_AT;
        mxS += ((tearing ? 0 : mx) - mxS) * (1 - Math.exp(-dt * 5));
        tiltRef.current.style.transform = `rotate(${(mxS * 2.1).toFixed(3)}deg)`;
      }

      /* Printed length, quantized to feed steps for a mechanical-transport feel. */
      const t = clamp01((p - PRINT_START) / (PRINT_END - PRINT_START));
      const len = Math.floor((t * totalH) / FEED_STEP_PX) * FEED_STEP_PX;
      paper.style.height = `${len}px`;

      /* Per-line thermal develop: a line darkens once it has fully left the slot. */
      let k = 0;
      for (let i = 0; i < rows.length; i++) {
        if (bottoms[i] <= len) {
          k = i + 1;
          if (!rows[i].dataset.on) rows[i].dataset.on = "1";
        } else if (rows[i].dataset.on) {
          delete rows[i].dataset.on;
        }
      }
      if (k !== lastK && lcdRef.current) {
        lastK = k;
        if (t > 0 && t < 1) {
          lcdRef.current.textContent = `PRINTING · LN ${pad2(k)}/${pad2(rows.length)}`;
        }
      }

      const phase: Phase =
        p < PRINT_START ? "idle" : p < STAMP_AT ? "print" : p < TEAR_AT ? "stamp" : p < OUT_AT ? "tear" : "out";
      if (phase !== lastPhase) {
        lastPhase = phase;
        sec.dataset.phase = phase;
        if (lcdRef.current && phase !== "print") {
          lcdRef.current.textContent = lcdTextRef.current[phase];
        }
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      if (ro) ro.disconnect();
      else removeEventListener("resize", measure);
      if (fine) removeEventListener("pointermove", onMove);
    };
  }, [lines, controlled, cursorTilt]);

  const renderLine = (line: ReceiptLine, i: number) => {
    switch (line.kind) {
      case "logo":
        return (
          <div key={i} className={s.lLogo}>
            {line.text}
          </div>
        );
      case "center":
        return (
          <div key={i} className={s.lC}>
            {line.text}
          </div>
        );
      case "rule":
        return <div key={i} className={s.lRule} />;
      case "kv":
        return (
          <div key={i} className={s.lKv}>
            <span>{line.label}</span>
            <i />
            <b>{line.value}</b>
          </div>
        );
      case "big":
        return (
          <div key={i} className={s.lBig}>
            {line.text}
            {line.em ? (
              <>
                {" "}
                <em>
                  <span>{line.em}</span>
                </em>
              </>
            ) : null}
          </div>
        );
      case "sub":
        return (
          <div key={i} className={s.lSub}>
            {line.text}
          </div>
        );
      case "total":
        return (
          <div key={i} className={s.totWrap}>
            <div className={s.lTotal}>
              <span>{line.label}</span>
              <i />
              <b>{line.value}</b>
            </div>
            {line.note ? <div className={s.lC}>{line.note}</div> : null}
            {stamp ? (
              <div className={s.stamp}>
                <b>{stamp.title}</b>
                {stamp.subtitle ? <em>{stamp.subtitle}</em> : null}
              </div>
            ) : null}
          </div>
        );
      case "barcode":
        return <div key={i} className={s.barcode} />;
    }
  };

  return (
    <section
      ref={secRef}
      className={className ? `${s.sec} ${className}` : s.sec}
      data-phase="idle"
      data-mode={controlled ? "controlled" : "scroll"}
      style={controlled ? undefined : { height: scrollLength }}
    >
      <div className={s.stage}>
        {/* Printing rig: paper plus printer body. Purely decorative for AT. */}
        <div className={s.rig} aria-hidden="true">
          <div className={s.paperSway}>
            <div className={s.paperTilt} ref={tiltRef}>
              <div className={s.paper} ref={paperRef}>
                <div className={s.paperIn} ref={innerRef}>
                  {lines.map(renderLine)}
                </div>
                <div className={s.paperShade} />
              </div>
            </div>
          </div>

          <div className={s.printer}>
            <div className={s.slotBack} />
            <div className={s.pbody}>
              <div className={s.slot}>
                <i className={s.stub} />
              </div>
              <div className={s.pface}>
                <span className={s.led} />
                <span className={s.lcd}>
                  <span ref={lcdRef}>{lcd?.idle ?? "IDLE · READY"}</span>
                </span>
                <span className={s.plabel}>{printerLabel}</span>
                <span className={s.grill} />
              </div>
            </div>
            <div className={s.pshadow} />
          </div>
        </div>

        {/* Post-tear reveal. */}
        {outro ? <div className={s.outro}>{outro}</div> : null}

        <div className={s.deskline} />
      </div>
    </section>
  );
}
