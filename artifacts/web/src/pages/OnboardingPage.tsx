import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Building2, MapPin, Package, CheckCircle } from "lucide-react";

const ALL_MODULES = [
  { key: "inventory", label: "Inventory Management", description: "Track stock levels and receive goods" },
  { key: "consumption_profiles", label: "Consumption Profiles", description: "Define how items consume resources when sold" },
  { key: "orders", label: "Orders", description: "Take and manage customer orders" },
  { key: "customers", label: "Customer Management", description: "Customer records and history" },
  { key: "employees", label: "Employee Management", description: "Employee directory and roles" },
  { key: "time_tracking", label: "Time Tracking", description: "Clock in/out, breaks, overtime" },
  { key: "scheduling", label: "Scheduling", description: "Employee shift scheduling" },
  { key: "purchasing", label: "Purchasing & Suppliers", description: "Purchase orders and supplier management" },
  { key: "invoice_ai", label: "AI Invoice Processing", description: "Automatically extract data from supplier invoices" },
  { key: "reporting", label: "Reporting", description: "Business analytics and reports" },
  { key: "api_access", label: "API Access / POS Integration", description: "External POS system integration via API keys" },
];

const LOCATION_TYPES = ["retail", "restaurant", "cafe", "salon", "workshop", "warehouse", "office", "other"];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Bogota", "America/Sao_Paulo", "Europe/London", "Europe/Madrid",
  "Asia/Mexico_City", "Pacific/Auckland",
];

const STEPS = ["Business Info", "First Location", "Modules", "Done"];

export function OnboardingPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);

  // Step 1
  const [bizName, setBizName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("America/New_York");

  // Step 2
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState("retail");
  const [locationTimezone, setLocationTimezone] = useState("America/New_York");

  // Step 3
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set(["inventory", "orders"]));

  const createBusiness = useMutation({
    mutationFn: async () => {
      const biz = await api.post("/businesses", { name: bizName, currencyCode: currency, timezone });
      const loc = await api.post("/locations", {
        businessId: biz.data.id,
        name: locationName || `${bizName} Main`,
        type: locationType,
        timezone: locationTimezone,
      });
      await api.put("/modules/bulk", {
        modules: [...selectedModules].map((key) => ({ module: key, enabled: true })),
      });
      return { business: biz.data, location: loc.data };
    },
    onSuccess: () => {
      setStep(3);
      setTimeout(() => navigate("/dashboard"), 1500);
    },
  });

  const toggleModule = (key: string) => {
    const next = new Set(selectedModules);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedModules(next);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-2xl">
        {/* Steps indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                i < step ? "bg-green-500 text-white" : i === step ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
              )}>
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-0.5 w-12", i < step ? "bg-green-500" : "bg-slate-200")} />}
            </div>
          ))}
        </div>

        {/* Step 0: Business Info */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bizName">Business Name *</Label>
                <Input id="bizName" placeholder="e.g. Maria's Coffee Shop" value={bizName} onChange={(e) => setBizName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm">
                    {["USD","COP","EUR","GBP","MXN","BRL","ARS","CLP","PEN","CRC"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tz">Timezone</Label>
                  <select id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm">
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
              <Button className="w-full" disabled={!bizName.trim()} onClick={() => setStep(1)}>
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: First Location */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> First Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="locName">Location Name</Label>
                <Input id="locName" placeholder={`${bizName} Main`} value={locationName} onChange={(e) => setLocationName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location Type</Label>
                  <select value={locationType} onChange={(e) => setLocationType(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm capitalize">
                    {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Location Timezone</Label>
                  <select value={locationTimezone} onChange={(e) => setLocationTimezone(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm">
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(2)}>Continue</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Modules */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Enable Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-500">Choose which features to enable for your business. You can change this later in Settings.</p>
              <div className="grid gap-2">
                {ALL_MODULES.map((m) => (
                  <label key={m.key} className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    selectedModules.has(m.key) ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                  )}>
                    <input type="checkbox" className="mt-0.5" checked={selectedModules.has(m.key)} onChange={() => toggleModule(m.key)} />
                    <div>
                      <p className="font-medium text-sm">{m.label}</p>
                      <p className="text-xs text-slate-500">{m.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button
                  className="flex-1"
                  disabled={createBusiness.isPending}
                  onClick={() => createBusiness.mutate()}
                >
                  {createBusiness.isPending ? "Setting up…" : "Launch BizCore →"}
                </Button>
              </div>
              {createBusiness.isError && (
                <p className="text-sm text-red-500">Setup failed. Please try again.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <h2 className="text-2xl font-bold text-slate-900">You're all set!</h2>
              <p className="text-slate-500 text-center">Taking you to your dashboard…</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
