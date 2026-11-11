import { useTranslation } from 'react-i18next';
import type { Config } from '../api.js';
import {
  activePeople,
  Field,
  listOptions,
  PeoplePicker,
  Section,
  SelectField,
  togglePerson,
  type ReportValuesProps,
} from './reportFields.js';

export function DetailsSection({ values, update }: ReportValuesProps) {
  const { t } = useTranslation();
  return (
    <Section title={t('report.whatHappened')}>
      <Field
        id="report-problem"
        label={t('report.problem')}
        value={values.problem}
        onChange={(problem) => update({ problem })}
        multiline
      />
      <Field
        id="report-observed"
        label={t('report.observedBy')}
        value={values.observedBy}
        onChange={(observedBy) => update({ observedBy })}
        placeholder={t('report.observedPlaceholder')}
      />
      <Field
        id="report-corrective"
        label={t('report.correctiveAction')}
        value={values.correctiveAction}
        onChange={(correctiveAction) => update({ correctiveAction })}
        multiline
      />
      <Field
        id="report-downtime"
        label={t('report.downtimeMin')}
        value={values.downtimeMin}
        onChange={(downtimeMin) => update({ downtimeMin })}
        type="number"
      />
      <Field
        id="report-response"
        label={t('report.responseMin')}
        value={values.responseMin}
        onChange={(responseMin) => update({ responseMin })}
        type="number"
      />
      <Field
        id="report-repair"
        label={t('report.repairMin')}
        value={values.repairMin}
        onChange={(repairMin) => update({ repairMin })}
        type="number"
      />
    </Section>
  );
}

export function PeopleSection({ values, update, config }: ReportValuesProps & { config: Config }) {
  const { t } = useTranslation();
  const people = activePeople(config.people);
  return (
    <Section title={t('report.whoDidWork')}>
      <PeoplePicker
        legend={t('report.doneBy')}
        people={people}
        selected={values.doneByPersonIds}
        onToggle={(personId) =>
          update({ doneByPersonIds: togglePerson(values.doneByPersonIds, personId) })
        }
      />
      <PeoplePicker
        legend={t('report.supportedBy')}
        people={people}
        selected={values.supportedByPersonIds}
        onToggle={(personId) =>
          update({ supportedByPersonIds: togglePerson(values.supportedByPersonIds, personId) })
        }
      />
    </Section>
  );
}

export function ClassificationSection({
  values,
  update,
  config,
}: ReportValuesProps & { config: Config }) {
  const { t } = useTranslation();
  const categoryOptions = listOptions(config, 'breakdown_category');
  const maintOptions = listOptions(config, 'maint_code');
  return (
    <Section title={t('report.classification')}>
      <SelectField
        id="report-category"
        label={t('report.breakdownCategory')}
        value={values.breakdownCategory}
        options={categoryOptions}
        onChange={(breakdownCategory) => update({ breakdownCategory })}
      />
      <SelectField
        id="report-maint"
        label={t('report.maintenanceCode')}
        value={values.maintCode}
        options={maintOptions}
        onChange={(maintCode) => update({ maintCode })}
      />
      <Field
        id="report-spare"
        label={t('report.spareUsed')}
        value={values.spareUsed}
        onChange={(spareUsed) => update({ spareUsed })}
      />
      <Field
        id="report-root"
        label={t('report.rootCause')}
        value={values.rootCause}
        onChange={(rootCause) => update({ rootCause })}
        multiline
      />
      <Field
        id="report-handover"
        label={t('report.handoverTo')}
        value={values.handoverName}
        onChange={(handoverName) => update({ handoverName })}
      />
    </Section>
  );
}
