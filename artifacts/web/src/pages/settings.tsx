import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useGetMyBusiness, 
  useUpdateBusiness, 
  useGetModules,
  useUpdateModules,
  useGetBusinessUsers,
  useUpsertBusinessUser,
  useDeactivateBusinessUser,
  useGetLocations,
  useGetCustomFields,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
  getGetMyBusinessQueryKey,
  getGetModulesQueryKey,
  getGetBusinessUsersQueryKey,
  getGetCustomFieldsQueryKey,
  type Business,
  type UpsertBusinessUserBodyRole,
  type CustomFieldDef,
  type CreateCustomFieldBodyEntityType,
  type CreateCustomFieldBodyType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Building2, Blocks, Loader2, Users, UserMinus, UserPlus, LayoutList, Plus, Pencil, Trash2, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

const businessSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  industry: z.string().min(1, "Please select an industry"),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
});

const assignMemberSchema = z.object({
  userId: z.string().min(1, "Clerk user ID is required"),
  role: z.enum(["admin", "manager", "cashier", "hr"]),
  locationId: z.string().optional(),
});

const ALL_MODULES = [
  { id: "orders", name: "Orders", description: "Manage customer orders and checkout" },
  { id: "inventory", name: "Inventory", description: "Track items, stock levels, and recipes" },
  { id: "employees", name: "Employees", description: "Manage staff, roles, and pay rates" },
  { id: "scheduling", name: "Scheduling", description: "Create and manage employee shifts" },
  { id: "time_tracking", name: "Time Tracking", description: "Clock in/out and timesheet approvals" },
  { id: "reports", name: "Reports", description: "Business analytics and performance metrics" },
];

const ENTITY_TYPES = [
  { value: "item", label: "Items" },
  { value: "order", label: "Orders" },
  { value: "employee", label: "Employees" },
] as const;

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select (dropdown)" },
  { value: "checkbox", label: "Checkbox" },
];

const EMPTY_CF_FORM = {
  name: "",
  type: "text" as CreateCustomFieldBodyType,
  options: "",
  sortOrder: "0",
  required: false,
};

function CustomFieldsManagerCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"item" | "order" | "employee">("item");
  const [dialog, setDialog] = useState<{
    open: boolean;
    field?: CustomFieldDef;
    form: typeof EMPTY_CF_FORM;
  }>({ open: false, form: { ...EMPTY_CF_FORM } });

  const { data: fields, isLoading } = useGetCustomFields({ entityType: activeTab });

  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCustomFieldsQueryKey({ entityType: activeTab }) });
    queryClient.invalidateQueries({ queryKey: getGetCustomFieldsQueryKey({}) });
  };

  const openCreate = () =>
    setDialog({ open: true, form: { ...EMPTY_CF_FORM } });

  const openEdit = (field: CustomFieldDef) =>
    setDialog({
      open: true,
      field,
      form: {
        name: field.name,
        type: field.type as CreateCustomFieldBodyType,
        options: Array.isArray(field.options)
          ? (field.options as string[]).join("\n")
          : "",
        sortOrder: String(field.sortOrder ?? 0),
        required: field.required,
      },
    });

  const handleSave = async () => {
    const { form, field } = dialog;
    if (!form.name.trim()) {
      toast({ title: "Field name is required", variant: "destructive" });
      return;
    }
    const options =
      form.type === "select"
        ? form.options
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean)
        : null;

    try {
      if (field) {
        await updateField.mutateAsync({
          id: field.id,
          data: {
            name: form.name.trim(),
            type: form.type,
            options,
            sortOrder: parseInt(form.sortOrder) || 0,
            required: form.required,
          },
        });
        toast({ title: "Field updated" });
      } else {
        await createField.mutateAsync({
          data: {
            entityType: activeTab as CreateCustomFieldBodyEntityType,
            name: form.name.trim(),
            type: form.type,
            options,
            sortOrder: parseInt(form.sortOrder) || 0,
            required: form.required,
          },
        });
        toast({ title: "Field created" });
      }
      invalidate();
      setDialog({ open: false, form: { ...EMPTY_CF_FORM } });
    } catch {
      toast({ title: "Error saving field", variant: "destructive" });
    }
  };

  const handleDelete = async (field: CustomFieldDef) => {
    try {
      await deleteField.mutateAsync({ id: field.id });
      toast({ title: `"${field.name}" deleted` });
      invalidate();
    } catch {
      toast({ title: "Error deleting field", variant: "destructive" });
    }
  };

  const fieldTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      text: "bg-blue-100 text-blue-800",
      number: "bg-purple-100 text-purple-800",
      date: "bg-green-100 text-green-800",
      select: "bg-orange-100 text-orange-800",
      checkbox: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[type] ?? "bg-gray-100 text-gray-800"}`}>
        {type}
      </span>
    );
  };

  return (
    <>
      <Card data-testid="card-custom-fields">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayoutList className="h-5 w-5" /> Custom Fields
            </CardTitle>
            <CardDescription className="mt-1">
              Define extra fields that appear on items, orders, and employees.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} data-testid="btn-add-custom-field">
            <Plus className="mr-1 h-4 w-4" /> Add Field
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-4">
              {ENTITY_TYPES.map((et) => (
                <TabsTrigger key={et.value} value={et.value} data-testid={`tab-cf-${et.value}`}>
                  {et.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {ENTITY_TYPES.map((et) => (
              <TabsContent key={et.value} value={et.value}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !fields || fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                    <LayoutList className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No custom fields for {et.label.toLowerCase()} yet
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={openCreate}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add first field
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((f) => (
                        <TableRow key={f.id} data-testid={`row-cf-${f.id}`}>
                          <TableCell className="font-medium">{f.name}</TableCell>
                          <TableCell>{fieldTypeBadge(f.type)}</TableCell>
                          <TableCell>
                            {f.required ? (
                              <Badge variant="default" className="text-xs">Required</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Optional</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{f.sortOrder}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(f)}
                                data-testid={`btn-edit-cf-${f.id}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    data-testid={`btn-delete-cf-${f.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete "{f.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will delete the field definition and all its stored values. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDelete(f)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog
        open={dialog.open}
        onOpenChange={(v) =>
          setDialog((d) => ({ ...d, open: v, form: v ? d.form : { ...EMPTY_CF_FORM } }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.field ? "Edit Custom Field" : "Add Custom Field"}</DialogTitle>
            <DialogDescription>
              Custom fields appear when creating or editing the entity.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {!dialog.field && (
              <div className="grid gap-1.5">
                <Label>Entity Type</Label>
                <Select
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((et) => (
                      <SelectItem key={et.value} value={et.value}>
                        {et.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Field Name *</Label>
              <Input
                value={dialog.form.name}
                onChange={(e) =>
                  setDialog((d) => ({ ...d, form: { ...d.form, name: e.target.value } }))
                }
                placeholder="e.g. Allergen Info"
                data-testid="input-cf-name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Field Type</Label>
              <Select
                value={dialog.form.type}
                onValueChange={(v) =>
                  setDialog((d) => ({
                    ...d,
                    form: { ...d.form, type: v as CreateCustomFieldBodyType },
                  }))
                }
              >
                <SelectTrigger data-testid="select-cf-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {ft.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dialog.form.type === "select" && (
              <div className="grid gap-1.5">
                <Label>Options (one per line)</Label>
                <Textarea
                  value={dialog.form.options}
                  onChange={(e) =>
                    setDialog((d) => ({ ...d, form: { ...d.form, options: e.target.value } }))
                  }
                  placeholder={"Option A\nOption B\nOption C"}
                  rows={4}
                  data-testid="textarea-cf-options"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={dialog.form.sortOrder}
                  onChange={(e) =>
                    setDialog((d) => ({ ...d, form: { ...d.form, sortOrder: e.target.value } }))
                  }
                />
              </div>
              <div className="flex flex-col justify-end gap-1.5">
                <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                  <Label className="cursor-pointer">Required</Label>
                  <Switch
                    checked={dialog.form.required}
                    onCheckedChange={(v) =>
                      setDialog((d) => ({ ...d, form: { ...d.form, required: v } }))
                    }
                    data-testid="switch-cf-required"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ open: false, form: { ...EMPTY_CF_FORM } })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createField.isPending || updateField.isPending}
              data-testid="btn-save-cf"
            >
              {dialog.field ? "Save Changes" : "Create Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  
  const { data: business, isLoading: isBusinessLoading } = useGetMyBusiness();
  const { data: modules, isLoading: isModulesLoading } = useGetModules();
  const { data: members, isLoading: isMembersLoading } = useGetBusinessUsers();
  const { data: locations } = useGetLocations();
  
  const updateBusiness = useUpdateBusiness();
  const updateModules = useUpdateModules();
  const upsertMember = useUpsertBusinessUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBusinessUsersQueryKey() });
        toast({ title: "Team member assigned" });
        setIsAssignOpen(false);
        assignForm.reset({ userId: "", role: "cashier", locationId: "" });
      },
      onError: () => {
        toast({ title: "Error assigning team member", variant: "destructive" });
      },
    },
  });
  const removeMember = useDeactivateBusinessUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBusinessUsersQueryKey() });
        toast({ title: "Team member removed" });
      },
      onError: () => {
        toast({ title: "Error removing member", variant: "destructive" });
      },
    },
  });

  const businessForm = useForm<z.infer<typeof businessSchema>>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: "", industry: "", address: "", phone: "", email: "" },
  });

  const assignForm = useForm<z.infer<typeof assignMemberSchema>>({
    resolver: zodResolver(assignMemberSchema),
    defaultValues: { userId: "", role: "cashier", locationId: "" },
  });

  // Init business form
  const initRef = useRef(false);
  useEffect(() => {
    if (business && !initRef.current) {
      businessForm.reset({
        name: business.name,
        industry: business.industry || "",
        address: business.address || "",
        phone: business.phone || "",
        email: business.email || "",
      });
      initRef.current = true;
    }
  }, [business, businessForm]);

  const onBusinessSubmit = async (values: z.infer<typeof businessSchema>) => {
    if (!business) return;
    try {
      await updateBusiness.mutateAsync({
        id: business.id,
        data: values,
      });
      queryClient.setQueryData<Business>(getGetMyBusinessQueryKey(), (old) => 
        old ? { ...old, ...values } : old
      );
      toast({ title: "Business settings saved" });
    } catch (error) {
      toast({ title: "Error saving settings", variant: "destructive" });
    }
  };

  const handleModuleToggle = async (moduleId: string, enabled: boolean) => {
    if (!modules) return;
    
    const currentModules = [...modules];
    const moduleIndex = currentModules.findIndex(m => m.module === moduleId);
    
    let newModulesPayload;
    
    if (moduleIndex >= 0) {
      currentModules[moduleIndex] = { ...currentModules[moduleIndex], enabled };
      newModulesPayload = currentModules.map(m => ({ module: m.module, enabled: m.enabled }));
    } else {
      newModulesPayload = [
        ...currentModules.map(m => ({ module: m.module, enabled: m.enabled })),
        { module: moduleId, enabled }
      ];
    }

    try {
      await updateModules.mutateAsync({
        data: { modules: newModulesPayload }
      });
      queryClient.invalidateQueries({ queryKey: getGetModulesQueryKey() });
      toast({ title: `Module ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error) {
      toast({ title: "Error updating modules", variant: "destructive" });
    }
  };

  const isModuleEnabled = (moduleId: string) => {
    return modules?.some(m => m.module === moduleId && m.enabled) || false;
  };

  const onAssignSubmit = (values: z.infer<typeof assignMemberSchema>) => {
    const locationId = values.locationId && values.locationId !== "none"
      ? parseInt(values.locationId, 10)
      : null;
    upsertMember.mutate({
      data: {
        userId: values.userId,
        role: values.role as UpsertBusinessUserBodyRole,
        locationId,
      },
    });
  };

  if (isBusinessLoading || isModulesLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center w-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your business profile and platform features.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Business Profile
            </CardTitle>
            <CardDescription>Update your company details and contact info.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...businessForm}>
              <form onSubmit={businessForm.handleSubmit(onBusinessSubmit)} className="space-y-4">
                <FormField control={businessForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-setting-biz-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={businessForm.control} name="industry" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="restaurant">Restaurant / F&B</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="service">Services</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Separator className="my-4" />
                <FormField control={businessForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl><Input type="email" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={businessForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={businessForm.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full mt-2" disabled={updateBusiness.isPending} data-testid="button-save-business">
                  {updateBusiness.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Profile
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Blocks className="h-5 w-5" /> Module Configuration
            </CardTitle>
            <CardDescription>Enable or disable platform features for your business.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {ALL_MODULES.map((mod) => (
              <div key={mod.id} className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="text-base font-semibold">{mod.name}</p>
                  <CardDescription>{mod.description}</CardDescription>
                </div>
                <Switch 
                  checked={isModuleEnabled(mod.id)}
                  onCheckedChange={(checked) => handleModuleToggle(mod.id, checked)}
                  disabled={updateModules.isPending}
                  data-testid={`switch-module-${mod.id}`}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-team-members">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Team Members
            </CardTitle>
            <CardDescription className="mt-1">Manage staff access and roles for your business.</CardDescription>
          </div>
          <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="btn-assign-member">
                <UserPlus className="mr-2 h-4 w-4" /> Assign Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Team Member</DialogTitle>
                <DialogDescription>Enter the Clerk user ID of the person you want to add to this business.</DialogDescription>
              </DialogHeader>
              <Form {...assignForm}>
                <form onSubmit={assignForm.handleSubmit(onAssignSubmit)} className="space-y-4 pt-2">
                  <FormField control={assignForm.control} name="userId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clerk User ID</FormLabel>
                      <FormControl>
                        <Input placeholder="user_2abc..." {...field} data-testid="input-assign-user-id" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={assignForm.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-assign-role"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="cashier">Cashier</SelectItem>
                          <SelectItem value="hr">HR</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={assignForm.control} name="locationId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="All locations" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">All locations</SelectItem>
                          {locations?.map((loc) => (
                            <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={upsertMember.isPending} data-testid="btn-confirm-assign">
                      {upsertMember.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Assign
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isMembersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !members || members.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No team members assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.membershipId} data-testid={`row-member-${member.membershipId}`}>
                    <TableCell className="font-medium">
                      {member.firstName || member.lastName
                        ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
                        : member.userId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === "admin" ? "default" : "secondary"} className="capitalize">
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.active ? "outline" : "destructive"}>
                        {member.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`btn-remove-member-${member.membershipId}`}>
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will deactivate their access to this business. You can re-assign them later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeMember.mutate({ id: member.membershipId })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomFieldsManagerCard />
    </div>
  );
}
