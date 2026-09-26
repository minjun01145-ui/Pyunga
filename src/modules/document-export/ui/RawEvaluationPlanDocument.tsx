import type {
  RawEvaluationPlanCellView,
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
    <article className={`${styles.document} ${styles[view.presentation.style]}`}>
      <header className={`${styles.documentHeader} ${headerOrientationClass}`}>
        {view.presentation.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.schoolLogo} src={view.presentation.logoDataUrl} alt={`${view.presentation.schoolName || "학교"} 교표`} />
        ) : null}
        {view.presentation.schoolName ? <p className={styles.schoolName}>{view.presentation.schoolName}</p> : null}
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
    <section
      className={`${styles.documentSection} ${orientationClass} ${levelClass}`}
      data-template-section-id={section.id}
    >
      <div className={styles.sectionHeading}>
        {section.marker ? <span className={styles.headingMarker}>{section.marker}</span> : null}
        <span className={styles.headingText}>{section.title}</span>
      </div>
      <div className={`${styles.sectionBody} ${section.content.kind === "table" ? styles.tableBody : ""}`}>
        {section.content.kind === "unconfigured" ? (
          <p>입력 양식이 설정되지 않은 항목입니다.</p>
        ) : null}
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
  return (
    <div className={styles.tableFrame}>
      <table className={styles.rawTable}>
        {table.columnWidths.length > 0 ? (
          <colgroup>
            {table.columnWidths.map((width, index) => (
              <col key={index} style={width ? { width: `${width / table.columnWidths.reduce<number>((sum, item) => sum + (item ?? 0), 0) * 100}%` } : undefined} />
            ))}
          </colgroup>
        ) : null}
        {table.headerRows.length > 0 && table.repeatHeader ? (
          <thead>
            {table.headerRows.map((row, index) => <RawRow key={`head-${index}`} row={row} />)}
          </thead>
        ) : null}
        {table.headerRows.length > 0 && !table.repeatHeader ? (
          <tbody className={styles.headerBlock}>
            {table.headerRows.map((row, index) => <RawRow key={`head-body-${index}`} row={row} />)}
          </tbody>
        ) : null}
        {table.bodyGroups.map((group, groupIndex) => (
          <tbody className={styles.rowBlock} key={`body-group-${groupIndex}`}>
            {group.map((row, rowIndex) => <RawRow key={`body-${groupIndex}-${rowIndex}`} row={row} />)}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function RawRow({ row }: { row: RawEvaluationPlanCellView[] }) {
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
