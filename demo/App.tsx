// Demo app: a fictional coffee shop receipt printed by scroll, plus a
// slider-driven example of controlled mode. All content here is made up.
import { useState } from "react";
import ThermalReceipt, { type ReceiptLine } from "../src";
import "./demo.css";

const LINES: ReceiptLine[] = [
  { kind: "logo", text: "CAFE MERIDIAN" },
  { kind: "center", text: "SPECIALTY COFFEE · SINCE 2019" },
  { kind: "center", text: "12 SAMPLE STREET · SPRINGFIELD" },
  { kind: "rule" },
  { kind: "kv", label: "OPEN", value: "07:00 – 19:00" },
  { kind: "kv", label: "TICKET", value: "#0042" },
  { kind: "rule" },
  { kind: "big", text: "GOOD COFFEE TAKES", em: "PATIENCE." },
  { kind: "sub", text: "Roasted in-house, brewed to order." },
  { kind: "rule" },
  { kind: "kv", label: "FLAT WHITE", value: "4.50" },
  { kind: "kv", label: "POUR OVER · ETHIOPIA", value: "5.25" },
  { kind: "kv", label: "ALMOND CROISSANT", value: "3.75" },
  { kind: "kv", label: "SPARKLING WATER", value: "2.50" },
  { kind: "rule" },
  { kind: "kv", label: "SUBTOTAL", value: "16.00" },
  { kind: "kv", label: "LOYALTY DISCOUNT", value: "-1.60" },
  { kind: "kv", label: "TAX", value: "1.15" },
  { kind: "rule" },
  { kind: "total", label: "TOTAL", value: "15.55", note: "( card · contactless )" },
  { kind: "rule" },
  { kind: "center", text: "THANK YOU FOR SCROLLING" },
  { kind: "barcode" },
  { kind: "center", text: "REPRINTS FREE · KEEP THE RECEIPT" },
];

const STAMP = { title: "PAID IN FULL", subtitle: "COME AGAIN · CAFE MERIDIAN" };
const LCD = { stamp: "PAID · 15.55" };

export default function App() {
  const [p, setP] = useState(0);

  return (
    <>
      <header className="hero">
        <p className="kicker">@intframe/thermal-receipt</p>
        <h1>
          A receipt printer
          <br />
          <em>you scroll.</em>
        </h1>
        <p className="lede">
          Scroll-driven thermal printing for React. Line-by-line develop, 3px paper
          feed steps, a live LCD, a stamp slam and a tear-off.
        </p>
        <p className="hint">SCROLL TO PRINT</p>
      </header>

      <ThermalReceipt
        lines={LINES}
        stamp={STAMP}
        lcd={LCD}
        printerLabel="MERIDIAN THERMAL · TR-26"
        outro={
          <>
            <p>Keep the receipt.</p>
            <em>Reprints are free. Scroll back up for another.</em>
          </>
        }
      />

      <section className="controlled">
        <div className="controlledHead">
          <h2>Controlled mode</h2>
          <p>
            Pass <code>progress</code> (0 to 1) and drive the print yourself.
          </p>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={p}
            onChange={(e) => setP(Number(e.target.value))}
            aria-label="Receipt print progress"
          />
        </div>
        <div className="controlledStage">
          <ThermalReceipt lines={LINES} stamp={STAMP} lcd={LCD} progress={p} cursorTilt={false} />
        </div>
      </section>

      <footer className="foot">
        Built at <a href="https://intframe.com">INTFRAME</a>, from the receipt chapter of our homepage.
      </footer>
    </>
  );
}
