export function Table({ columns = [], data = [], renderCell, rowKey = 'id', className = '' }) {
  return (
    <table className={['ap-table', className].filter(Boolean).join(' ')}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={{ textAlign: c.align || 'left', width: c.width }}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={row[rowKey] != null ? row[rowKey] : i}>
            {columns.map((c) => (
              <td key={c.key} style={{ textAlign: c.align || 'left' }}>
                {renderCell ? renderCell(row, c) : row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
