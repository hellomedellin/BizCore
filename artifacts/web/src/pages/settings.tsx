import { useEffect, useRef } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useGetMyBusiness, 
  useUpdateBusiness, 
  useGetModules,
  useUpdateModules,
  getGetMyBusinessQueryKey,
  getGetModulesQueryKey,
  type Business,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Building2, Blocks, Loader2, Users, UserMinus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const businessSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  industry: z.string().min(1, "Please select an industry"),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
});

type BusinessMember = {
  membershipId: number;
  userId: string;
  role: string;
  locationId: number | null;
  active: boolean;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string | null;
};

const BUSINESS_MEMBERS_KEY = ["business-members"];

async function fetchBusinessMembers(): Promise<BusinessMember[]> {
  const res = await fetch("/api/business-users", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load team members");
  return res.json() as Promise<BusinessMember[]>;
}

async function deactivateMember(membershipId: number): Promise<void> {
  const res = await fetch(`/api/business-users/${membershipId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to remove member");
}

const ALL_MODULES = [
  { id: "orders", name: "Orders", description: "Manage customer orders and checkout" },
  { id: "inventory", name: "Inventory", description: "Track items, stock levels, and recipes" },
  { id: "employees", name: "Employees", description: "Manage staff, roles, and pay rates" },
  { id: "scheduling", name: "Scheduling", description: "Create and manage employee shifts" },
  { id: "time_tracking", name: "Time Tracking", description: "Clock in/out and timesheet approvals" },
  { id: "reports", name: "Reports", description: "Business analytics and performance metrics" },
];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: business, isLoading: isBusinessLoading } = useGetMyBusiness();
  const { data: modules, isLoading: isModulesLoading } = useGetModules();
  
  const updateBusiness = useUpdateBusiness();
  const updateModules = useUpdateModules();

  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: BUSINESS_MEMBERS_KEY,
    queryFn: fetchBusinessMembers,
  });

  const removeMember = useMutation({
    mutationFn: deactivateMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUSINESS_MEMBERS_KEY });
      toast({ title: "Team member removed" });
    },
    onError: () => {
      toast({ title: "Error removing member", variant: "destructive" });
    },
  });

  const businessForm = useForm<z.infer<typeof businessSchema>>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: "", industry: "", address: "", phone: "", email: "" },
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
    
    // Create new modules array with the toggled module
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Team Members
          </CardTitle>
          <CardDescription>Manage staff access and roles for your business.</CardDescription>
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
                              onClick={() => removeMember.mutate(member.membershipId)}
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
    </div>
  );
}
