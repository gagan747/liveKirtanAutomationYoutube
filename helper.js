export const getIndianDate = () => new Date(new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' }));
