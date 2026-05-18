import type { ReactElement } from "react";

import type { TypaiDebugTableProps } from "../types";

const emptyDebugData = {
  recentEvents: [],
  correctionCount: 0,
  unresolvedCount: 0,
  revertCount: 0,
  protectedSkipCount: 0,
  latenciesMs: [],
};

export function TypaiDebugTable({
  data,
  label = "Typai debug summary",
}: TypaiDebugTableProps): ReactElement {
  const debugData = {
    ...emptyDebugData,
    ...data,
    recentEvents: data?.recentEvents ?? emptyDebugData.recentEvents,
    latenciesMs: data?.latenciesMs ?? emptyDebugData.latenciesMs,
  };

  return (
    <section aria-label={label} data-typai-react-debug-table="true">
      <dl>
        <dt>Corrections</dt>
        <dd>{debugData.correctionCount}</dd>
        <dt>Unresolved</dt>
        <dd>{debugData.unresolvedCount}</dd>
        <dt>Reverts</dt>
        <dd>{debugData.revertCount}</dd>
        <dt>Protected skips</dt>
        <dd>{debugData.protectedSkipCount}</dd>
        <dt>Latency samples</dt>
        <dd>{debugData.latenciesMs.length}</dd>
      </dl>
      <table>
        <caption>Recent local Typai events</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Source</th>
            <th scope="col">Action</th>
            <th scope="col">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {debugData.recentEvents.map((event) => (
            <tr
              key={`${event.time}-${event.source}-${event.action}-${event.outcome}-${event.reasonCodes?.join("|") ?? ""}-${event.latencyMs ?? ""}`}
            >
              <td>{event.time}</td>
              <td>{event.source}</td>
              <td>{event.action}</td>
              <td>{event.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
