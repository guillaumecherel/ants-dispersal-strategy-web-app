const dateFormatterFr = Intl.DateTimeFormat("fr-FR", {dateStyle: "medium", timeStyle: 'long'})
export const formatDate = dateFormatterFr.format

const shortDateFormatterFr = Intl.DateTimeFormat("fr-FR", {dateStyle: "short", timeStyle: 'long'})
export const shortDate = shortDateFormatterFr.format
