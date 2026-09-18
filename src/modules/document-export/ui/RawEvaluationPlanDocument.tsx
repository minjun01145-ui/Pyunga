import type {
  RawEvaluationPlanDocumentView,
  RawEvaluationPlanSectionView,
  RawEvaluationPlanTableView,
} from "../application/raw-evaluation-plan-document";

import styles from "./RawEvaluationPlanDocument.module.css";

export function RawEvaluationPlanDocument({ view }: { view: RawEvaluationPlanDocumentView }) {
  const headerOrientationClass = view.firstPageOrientation === "landscape"
    ? styles.orientationLandscape
    : styles.orientationPortrait;
  return (
    <article className={styles.document}>
      <header className={`${styles.documentHeader} ${headerOrientationClass}`}>
        <h1>{view.title}</h1>
        {view.metadataLine ? <p>{view.metadataLine}</p> : null}
      </header>

      {view.sections.map((section) => (
        <RawSection key={section.id} section={section} />
      ))}
    </article>
  );
}

function RawSection({ section }: { section: RawEvaluationPlanSectionView }) {
  const orientationClass = section.orientation === "landscape"
    ? styles.orientationLandscape
    : styles.orientationPortrait;
  const levelClass = styles[`level${section.level}` as keyof typeof styles];

  return (
    <section className={`${styles.documentSection} ${orientationClass} ${levelClass}`}>
      <div className={styles.sectionHeading}>
        {section.marker ? <span className={styles.headingMarker}>{section.marker}</span> : null}
        <span className={styles.headingText}>{section.title}</span>
      </div>
      <div className={`${styles.sectionBody} ${section.content.kind === "table" ? styles.tableBody : ""}`}>
        {section.content.kind === "text" ? (
          <div className={styles.outlineText}>{section.content.text}</div>
        ) : null}
        {section.content.kind === "table" ? (
          <RawTable table={section.content.table} />
        ) : null}
      </div>
    </section>
  );
}

function RawTable({ table }: { table: RawEvaluationPlanTableView }) {
  const headerRows = table.rows.slice(0, table.repeatingHeaderRowCount);
  const bodyRows = table.rows.slice(table.repeatingHeaderRowCount);

  return (
    <div className={styles.tableFrame}>
      <table className={styles.rawTable}>
        {table.columnWidths.length > 0 ? (
          <colgroup>
            {table.columnWidths.map((width, index) => (
              <col key={index} style={width ? { width: `${width}px` } : undefined} />
            ))}
          </colgroup>
        ) : null}
        {headerRows.length > 0 ? (
          <thead>
            {headerRows.map((row, index) => <RawRow key={`head-${index}`} row={row} />)}
          </thead>
        ) : null}
        <tbody>
          {bodyRows.map((row, index) => <RawRow key={`body-${index}`} row={row} />)}
        </tbody>
      </table>
    </div>
  );
}

function RawRow({ row }: { row: RawEvaluationPlanTableView["rows"][number] }) {
  return (
    <tr className={styles.tableRow}>
      {row.map((cell) => {
        const CellTag = cell.header ? "th" : "td";
        return (
          <CellTag key={cell.key} colSpan={cell.colspan} rowSpan={cell.rowspan}>
            {cell.text}
          </CellTag>
        );
      })}
    </tr>
  );
}
