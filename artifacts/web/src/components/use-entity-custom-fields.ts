import { useState, useEffect, useRef } from "react";
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
  // Track which field IDs the user explicitly changed, so we never overwrite
  // server values with null for fields not yet loaded (race condition on edit open)
  const touchedFieldIds = useRef<Set<number>>(new Set());

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
      touchedFieldIds.current = new Set();
    }
    if (!entityId) {
      setValues({});
      setInitializedForId(null);
      touchedFieldIds.current = new Set();
    }
  }, [entityId, existingValues]);

  const reset = () => {
    setValues({});
    setInitializedForId(null);
    touchedFieldIds.current = new Set();
  };

  const setFieldValue = (fieldId: number, value: string | null) => {
    touchedFieldIds.current.add(fieldId);
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const save = async (resolvedEntityId: number) => {
    if (!fields?.length) return;

    const hydrated = initializedForId === resolvedEntityId;

    // If hydrated: submit all fields (safe — values reflect real server state + edits)
    // If NOT hydrated (race condition or new entity): submit only explicitly touched fields
    const fieldsToSave = hydrated
      ? fields
      : fields.filter((f) => touchedFieldIds.current.has(f.id));

    if (!fieldsToSave.length) return;

    const toSave = fieldsToSave.map((f) => ({
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
    isHydrated: !entityId || initializedForId === entityId,
  };
}
