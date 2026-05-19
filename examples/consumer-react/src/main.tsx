import { createTypaiCore } from "@typai/core";
import { TypaiContenteditable, TypaiProvider, TypaiTextarea } from "@typai/react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import "./style.css";

function App() {
  const [lastEvent, setLastEvent] = useState("Typai React example is loading...");

  return (
    <TypaiProvider createCore={createTypaiCore}>
      <main className="page">
        <section className="panel">
          <h1>React correction</h1>
          <p>
            Type a completed word such as <code>teh </code> or <code>recieve </code>.
          </p>
          <div className="grid">
            <div className="field">
              <span>Textarea</span>
              <TypaiTextarea
                defaultValue="Try typing teh React textarea update."
                spellCheck={false}
                overlay={{ enabled: true }}
                onCorrection={(event) => {
                  setLastEvent(
                    `Textarea corrected "${event.transaction.original}" to "${event.transaction.replacement}".`,
                  );
                }}
              />
            </div>
            <div className="field">
              <span>Contenteditable</span>
              <TypaiContenteditable
                className="editable"
                spellCheck={false}
                onCorrection={(transaction) => {
                  setLastEvent(
                    `Contenteditable corrected "${transaction.original}" to "${transaction.replacement}".`,
                  );
                }}
              >
                Try typing teh React contenteditable update.
              </TypaiContenteditable>
            </div>
          </div>
          <pre aria-live="polite">{lastEvent}</pre>
        </section>
      </main>
    </TypaiProvider>
  );
}

const root = document.querySelector("#root");

if (root === null) {
  throw new Error("Missing React root element.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
