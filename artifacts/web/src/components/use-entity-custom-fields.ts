import { useState, useEffect } from "react";
import {
  useGetCustomFields,
  useGetCustomFieldValues,
  useUpsertCustomFieldValues,
  getGetCustomFieldValuesQueryKey,
} from "@workspace/api-client-react";

export type EntityType = "item" | "order" | "employee";

export function useEntityCustomFields(entityType: EntityType, entityId?: number) {
  const [values, setValues] = useState<Record<number, string | null>>({});
  const [initializedForId, setInitializedForId] = useState<number | null>(null);

  const { data: fields } = useGetCustomFields({ entityType });

  const { data: existingValues } = useGetCustomFieldValues(
    { entityType, entityId: entityId! },
    {
      query: {
        enabled: !!entityId,
        queryKey: getGetCustomFieldValuesQueryKey({ entityType, entityId: entityId! }),
      },
    }
  );

  const upsertValues = useUpsertCustomFieldValues();

  useEffect(() => {
    if (entityId && existingValues && initializedForId !== entityId) {
      const map: Record<number, string | null> = {};
      for (const v of existingValues) {
        map[v.fieldId] = v.value ?? null;
      }
      setValues(map);
      setInitializedForId(entityId);
    }
    if (!entityId) {
      setValues({});
      setInitializedForId(null);
    }
  }, [entityId, existingValues]);

  const reset = () => {
    setValues({});
    setInitializedForId(null);
  };

  const setFieldValue = (fieldId: number, value: string | null) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const save = async (resolvedEntityId: number) => {
    if (!fields?.length) return;
    const toSave = fields.map((f) => ({
      fieldId: f.id,
      value: values[f.id] ?? null,
    }));
    await upsertValues.mutateAsync({
      data: {
        entityType,
        entityId: resolvedEntityId,
        values: toSave,
      },
    });
  };

  return {
    fields: fields ?? [],
    values,
    setFieldValue,
    save,
    reset,
    isSaving: upsertValues.isPending,
  };
}
