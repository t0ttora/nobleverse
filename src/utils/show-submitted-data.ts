// Basit bir form submit gösterici. Geliştirilebilir.
export function showSubmittedData(data: any) {
  // eslint-disable-next-line no-alert
  alert(JSON.stringify(data, null, 2));
}
