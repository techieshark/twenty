import { Controller, useFormContext } from 'react-hook-form';
import { z } from 'zod';

import { FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { currencyCodeSchema } from '@/object-record/record-field/validation-schemas/currencyCodeSchema';
import { SETTINGS_FIELD_CURRENCY_CODES } from '@/settings/data-model/constants/SettingsFieldCurrencyCodes';
import { useCurrencySettingsFormInitialValues } from '@/settings/data-model/fields/forms/currency/hooks/useCurrencySettingsFormInitialValues';
import { Select } from '@/ui/input/components/Select';
import { CardContent } from '@/ui/layout/card/components/CardContent';
import { applySimpleQuotesToString } from '~/utils/string/applySimpleQuotesToString';
import { stripSimpleQuotesFromString } from '~/utils/string/stripSimpleQuotesFromString';
import { simpleQuotesStringSchema } from '~/utils/validation-schemas/simpleQuotesStringSchema';

export const settingsDataModelFieldCurrencyFormSchema = z.object({
  defaultValue: z.object({
    amountMicros: z.number().nullable(),
    currencyCode: simpleQuotesStringSchema.refine(
      (value) =>
        currencyCodeSchema.safeParse(stripSimpleQuotesFromString(value))
          .success,
      { message: 'String is not a valid currencyCode' },
    ),
  }),
});

export type SettingsDataModelFieldCurrencyFormValues = z.infer<
  typeof settingsDataModelFieldCurrencyFormSchema
>;

type SettingsDataModelFieldCurrencyFormProps = {
  disabled?: boolean;
  fieldMetadataItem: Pick<FieldMetadataItem, 'defaultValue'>;
};

const OPTIONS = Object.entries(SETTINGS_FIELD_CURRENCY_CODES).map(
  ([value, { label, Icon }]) => ({
    label,
    value: applySimpleQuotesToString(value),
    Icon,
  }),
);

export const SettingsDataModelFieldCurrencyForm = ({
  disabled,
  fieldMetadataItem,
}: SettingsDataModelFieldCurrencyFormProps) => {
  const { control } =
    useFormContext<SettingsDataModelFieldCurrencyFormValues>();

  const { initialAmountMicrosValue, initialCurrencyCodeValue } =
    useCurrencySettingsFormInitialValues({ fieldMetadataItem });

  return (
    <CardContent>
      <Controller
        name="defaultValue.amountMicros"
        control={control}
        defaultValue={initialAmountMicrosValue}
        render={() => <></>}
      />
      <Controller
        name="defaultValue.currencyCode"
        control={control}
        defaultValue={initialCurrencyCodeValue}
        render={({ field: { onChange, value } }) => (
          <Select
            fullWidth
            disabled={disabled}
            label="Default Unit"
            dropdownId="currency-unit-select"
            value={value}
            options={OPTIONS}
            onChange={onChange}
          />
        )}
      />
    </CardContent>
  );
};
