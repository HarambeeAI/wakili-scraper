import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FieldSchema {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number;
}

interface DynamicFormProps {
  schema: FieldSchema[];
  title?: string;
  onSubmit: (values: Record<string, string | number>) => void;
  submitLabel?: string;
}

export function DynamicForm({ schema, title, onSubmit, submitLabel }: DynamicFormProps) {
  const initialValues = schema.reduce<Record<string, string | number>>((acc, field) => {
    if (field.defaultValue !== undefined) {
      acc[field.name] = field.defaultValue;
    }
    return acc;
  }, {});

  const [values, setValues] = useState<Record<string, string | number>>(initialValues);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <div>
      {title && <h3 className="text-sm font-semibold mb-3">{title}</h3>}
      <form onSubmit={handleSubmit} className="space-y-3">
        {schema.map((field) => (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>

            {field.type === "textarea" ? (
              <Textarea
                id={field.name}
                placeholder={field.placeholder}
                value={(values[field.name] as string) ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
                required={field.required}
              />
            ) : field.type === "select" ? (
              <select
                id={field.name}
                value={(values[field.name] as string) ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
                required={field.required}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={field.name}
                type={field.type}
                placeholder={field.placeholder}
                value={(values[field.name] as string | number) ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.name]:
                      field.type === "number" ? Number(e.target.value) : e.target.value,
                  }))
                }
                required={field.required}
              />
            )}
          </div>
        ))}
        <Button type="submit" className="w-full mt-4">
          {submitLabel ?? "Submit"}
        </Button>
      </form>
    </div>
  );
}
