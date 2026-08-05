import { useState, useEffect, useRef } from "react";
import { lookupPincode } from "@/integrations/mongodb/pincode.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type PincodeAddressValue = {
  postal_code: string;
  city: string;
  region: string; // state
  country: string;
};

type Office = Awaited<ReturnType<typeof lookupPincode>>[number];

/**
 * Drop-in replacement for a plain "Postal code" input. Debounces lookup on
 * pincode entry; if the pincode matches more than one office (the norm for
 * Indian pincodes — roughly 9 in 10 do), shows a selector so the customer
 * picks their specific area/locality, which also disambiguates city/district
 * when multiple offices under one pincode span different localities.
 */
export function PincodeAddressFields({
  value,
  onChange,
}: {
  value: PincodeAddressValue;
  onChange: (next: PincodeAddressValue) => void;
}) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("");
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastLookedUp = useRef<string>("");

  useEffect(() => {
    const pin = value.postal_code.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Only look up once a full 6-digit Indian pincode is entered, and only
    // if it actually changed — avoids a lookup on every keystroke while
    // someone edits an already-resolved value.
    if (!/^\d{6}$/.test(pin) || pin === lastLookedUp.current) {
      if (pin.length < 6) {
        setOffices([]);
        setNotFound(false);
      }
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLooking(true);
      setNotFound(false);
      try {
        const results = await lookupPincode({ data: { pincode: pin } });
        lastLookedUp.current = pin;
        setOffices(results);
        if (results.length === 1) {
          applyOffice(results[0]);
        } else if (results.length === 0) {
          setNotFound(true);
        }
      } finally {
        setLooking(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.postal_code]);

  function applyOffice(office: Office) {
    setSelectedOfficeId(office.id);
    onChange({
      ...value,
      city: office.district || value.city,
      region: office.state_name || value.region,
      country: value.country || "IN",
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Postal code *</Label>
        <div className="relative">
          <Input
            value={value.postal_code}
            onChange={(e) => onChange({ ...value, postal_code: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            placeholder="6-digit PIN code"
            required
          />
          {looking ? <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-2.5 text-muted-foreground" /> : null}
        </div>
        {notFound ? (
          <p className="text-xs text-muted-foreground mt-1">
            Pincode not found in our records — please fill in city/state manually below.
          </p>
        ) : null}
      </div>

      {offices.length > 1 ? (
        <div>
          <Label>Select your area *</Label>
          <Select value={selectedOfficeId} onValueChange={(id) => applyOffice(offices.find((o) => o.id === id)!)}>
            <SelectTrigger>
              <SelectValue placeholder={`${offices.length} localities found for this pincode — choose yours`} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {offices.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.office_name}
                  {o.district ? ` — ${o.district}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
