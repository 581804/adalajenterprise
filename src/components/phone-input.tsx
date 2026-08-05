import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCountryCodes } from "@/integrations/mongodb/country-code.functions";
import { isValidPhoneForCountry } from "@/lib/phone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X } from "lucide-react";

export type PhoneValue = {
  iso2: string; // e.g. "IN"
  local: string; // e.g. "9876543210", no country code
};

export function PhoneInput({
  value,
  onChange,
  defaultIso2 = "IN",
  required,
}: {
  value: PhoneValue;
  onChange: (next: PhoneValue) => void;
  defaultIso2?: string;
  required?: boolean;
}) {
  const { data: countries } = useQuery({
    queryKey: ["country-codes"],
    queryFn: () => listCountryCodes(),
    staleTime: Infinity, // this data never changes at runtime — only via the seed script
  });

  useEffect(() => {
    if (!value.iso2 && countries?.length) {
      onChange({ ...value, iso2: defaultIso2 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries]);

  const selected = countries?.find((c) => c.iso2 === value.iso2);
  const isValid = value.local ? isValidPhoneForCountry(value.local, value.iso2) : !required;
  const showValidation = value.local.length > 0;

  return (
    <div>
      <Label>Phone {required ? "*" : ""}</Label>
      <div className="flex gap-2">
        <Select value={value.iso2} onValueChange={(iso2) => onChange({ ...value, iso2 })}>
          <SelectTrigger className="w-[110px] shrink-0">
            <SelectValue>{selected ? `+${selected.calling_code}` : "…"}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {countries?.map((c) => (
              <SelectItem key={c.iso2} value={c.iso2}>
                {c.name} (+{c.calling_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Input
            type="tel"
            value={value.local}
            onChange={(e) => onChange({ ...value, local: e.target.value.replace(/[^\d]/g, "") })}
            placeholder="Phone number"
            required={required}
          />
          {showValidation ? (
            isValid ? (
              <Check className="h-4 w-4 text-green-600 absolute right-3 top-2.5" />
            ) : (
              <X className="h-4 w-4 text-destructive absolute right-3 top-2.5" />
            )
          ) : null}
        </div>
      </div>
      {showValidation && !isValid ? (
        <p className="text-xs text-destructive mt-1">Not a valid phone number for {selected?.name ?? "the selected country"}.</p>
      ) : null}
    </div>
  );
}
