/**
 * The forecast face (packet 42e): A9's chart chrome, the Forecast Lab's chart chrome and the group's screen menu.
 * Its own namespace, so the main analytics catalogue and this screen's copy never edit one file and both stay
 * under the 250-line catalogue cap. Every key keeps its family prefix, so the face reads one flat catalogue.
 */
export const analyticsForecastEn = {
  'analytics.content.a9.mapChart': 'Risk map — every machine, grouped by kind',
  'analytics.content.a9.machineLabel': 'Machine',
  'analytics.content.a9.hoursLabel': 'BD hrs',
  'analytics.content.a9.forecastChart': 'Expected downtime, machine by machine',
  'analytics.content.a9.forecastCategory': 'Machine · category',
  'analytics.content.forecastLab.chart': 'Plant downtime: forecast against actual, month by month',
  'analytics.content.forecastLab.monthAxis': 'Month',
};
