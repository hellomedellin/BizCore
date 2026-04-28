import type { CustomFieldDef } from "@workspace/api-client-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDef;
  value: string | null;
  onChange: (fieldId: number, value: string | null) => void;
}) {
  const val = value ?? "";

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2 h-9">
        <Checkbox
          id={`cf-${field.id}`}
          checked={val === "true"}
          onCheckedChange={(checked) =>
            onChange(field.id, checked ? "true" : "false")
          }
        />
        <label htmlFor={`cf-${field.id}`} className="text-sm cursor-pointer">
          {field.name}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </label>
      </div>
    );
  }

  if (field.type === "select" && Array.isArray(field.options) && field.options.length > 0) {
    const options = field.options as string[];
    return (
      <Select
        value={val || ""}
        onValueChange={(v) => onChange(field.id, v || null)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "number") {
    return (
      <Input
        type="number"
        step="any"
        value={val}
        onChange={(e) => onChange(field.id, e.target.value || null)}
        placeholder={`Enter ${field.name.toLowerCase()}`}
      />
    );
  }

  if (field.type === "date") {
    return (
      <Input
        type="date"
        value={val}
        onChange={(e) => onChange(field.id, e.target.value || null)}
      />
    );
  }

  return (
    <Input
      value={val}
      onChange={(e) => onChange(field.id, e.target.value || null)}
      placeholder={`Enter ${field.name.toLowerCase()}`}
    />
  );
}

export function CustomFieldsSection({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldDef[];
  values: Record<number, string | null>;
  onChange: (fieldId: number, value: string | null) => void;
}) {
  if (!fields.length) return null;

  return (
    <div className="space-y-3">
      <Separator />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Custom Fields
      </p>
      {fields.map((field) => (
        <div key={field.id} className="grid gap-1.5">
          {field.type !== "checkbox" && (
            <Label htmlFor={`cf-${field.id}`}>
              {field.name}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
          )}
          <FieldInput field={field} value={values[field.id] ?? null} onChange={onChange} />
        </div>
      ))}
    </div>
  );
}

export function CustomFieldsReadView({
  fields,
  values,
}: {
  fields: CustomFieldDef[];
  values: Record<number, string | null>;
}) {
  if (!fields.length) return null;

  const formatValue = (field: CustomFieldDef, raw: string | null): string => {
    if (raw === null || raw === "") return "—";
    if (field.type === "checkbox") return raw === "true" ? "Yes" : "No";
    return raw;
  };

  return (
    <div className="space-y-3">
      <Separator />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Custom Fields
      </p>
      {fields.map((field) => (
        <div key={field.id} className="flex justify-between items-start gap-4 text-sm">
          <span className="text-muted-foreground shrink-0">{field.name}</span>
          <span className="font-medium text-right">{formatValue(field, values[field.id] ?? null)}</span>
        </div>
      ))}
    </div>
  );
}
