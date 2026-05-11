export function paginate<T>(rows: T[], page: number, pageSize: number) {
  return rows.slice(page * pageSize, page * pageSize + pageSize);
}
