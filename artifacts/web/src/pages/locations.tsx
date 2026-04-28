import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useGetLocations, 
  useCreateLocation, 
  useUpdateLocation, 
  useDeleteLocation,
  getGetLocationsQueryKey,
  type Location,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Edit2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const locationSchema = z.object({
  name: z.string().min(2, "Location name must be at least 2 characters"),
  type: z.string().min(1, "Please select a location type"),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

type LocationFormValues = z.infer<typeof locationSchema>;

export default function Locations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: locations, isLoading } = useGetLocations();
  
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const addForm = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { name: "", type: "store", address: "", phone: "" },
  });

  const editForm = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { name: "", type: "store", address: "", phone: "" },
  });

  const onAddSubmit = async (values: LocationFormValues) => {
    try {
      await createLocation.mutateAsync({
        data: values,
      });
      queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
      toast({ title: "Location created" });
      setIsAddOpen(false);
      addForm.reset();
    } catch (error) {
      toast({ title: "Error creating location", variant: "destructive" });
    }
  };

  const onEditSubmit = async (values: LocationFormValues) => {
    if (!editingId) return;
    try {
      await updateLocation.mutateAsync({
        id: editingId,
        data: values,
      });
      queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
      toast({ title: "Location updated" });
      setEditingId(null);
    } catch (error) {
      toast({ title: "Error updating location", variant: "destructive" });
    }
  };

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      await updateLocation.mutateAsync({
        id,
        data: { active: !currentActive },
      });
      queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
      toast({ title: `Location ${!currentActive ? 'activated' : 'deactivated'}` });
    } catch (error) {
      toast({ title: "Error updating location status", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLocation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
      toast({ title: "Location deleted" });
    } catch (error) {
      toast({ title: "Error deleting location", variant: "destructive" });
    }
  };

  const openEditDialog = (location: Location) => {
    editForm.reset({
      name: location.name,
      type: location.type,
      address: location.address || "",
      phone: location.phone || "",
    });
    setEditingId(location.id);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground">Manage your physical business locations.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-location">
              <Plus className="mr-2 h-4 w-4" /> Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>Create a new physical location for your business.</DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                <FormField control={addForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name</FormLabel>
                    <FormControl><Input placeholder="Downtown Store" {...field} data-testid="input-add-location-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger data-testid="select-add-location-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="hq">Headquarters</SelectItem>
                        <SelectItem value="store">Retail Store</SelectItem>
                        <SelectItem value="restaurant">Restaurant</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl><Input placeholder="123 Main St" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl><Input placeholder="(555) 123-4567" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit" disabled={createLocation.isPending} data-testid="button-submit-add-location">
                    {createLocation.isPending ? "Creating..." : "Create Location"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Locations</CardTitle>
          <CardDescription>A list of all your business locations.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : locations && locations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id} data-testid={`row-location-${loc.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {loc.name}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{loc.type}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {loc.address && <div>{loc.address}</div>}
                        {loc.phone && <div className="text-muted-foreground">{loc.phone}</div>}
                        {!loc.address && !loc.phone && <span className="text-muted-foreground italic">No contact info</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={loc.active ? 'default' : 'secondary'} className="capitalize">
                        {loc.active ? (
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Active</span>
                        ) : (
                          <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Inactive</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(loc.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleToggleActive(loc.id, loc.active)}
                          disabled={updateLocation.isPending}
                          data-testid={`button-toggle-status-${loc.id}`}
                        >
                          {loc.active ? "Deactivate" : "Activate"}
                        </Button>
                        
                        <Dialog open={editingId === loc.id} onOpenChange={(open) => !open && setEditingId(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(loc)} data-testid={`button-edit-location-${loc.id}`}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Location</DialogTitle>
                              <DialogDescription>Update details for {loc.name}.</DialogDescription>
                            </DialogHeader>
                            <Form {...editForm}>
                              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                                <FormField control={editForm.control} name="name" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Location Name</FormLabel>
                                    <FormControl><Input {...field} data-testid="input-edit-location-name" /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={editForm.control} name="type" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="hq">Headquarters</SelectItem>
                                        <SelectItem value="store">Retail Store</SelectItem>
                                        <SelectItem value="restaurant">Restaurant</SelectItem>
                                        <SelectItem value="warehouse">Warehouse</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={editForm.control} name="address" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Address</FormLabel>
                                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={editForm.control} name="phone" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Phone</FormLabel>
                                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <DialogFooter>
                                  <Button type="submit" disabled={updateLocation.isPending} data-testid="button-submit-edit-location">
                                    {updateLocation.isPending ? "Saving..." : "Save Changes"}
                                  </Button>
                                </DialogFooter>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-location-${loc.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the location "{loc.name}". This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(loc.id)} 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-testid={`button-confirm-delete-${loc.id}`}
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
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed">
              <div className="text-center text-muted-foreground">
                <p>No locations found.</p>
                <Button variant="link" onClick={() => setIsAddOpen(true)}>Add your first location</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
