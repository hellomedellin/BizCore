import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, DollarSign, Users, AlertTriangle, Clock, Package } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();

  const formatCurrency = (val: number | string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(val));
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your business operations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders Today</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <div className="text-2xl font-bold" data-testid="metric-orders-today">
                {summary?.totalOrdersToday || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-24 mt-1" />
            ) : (
              <div className="text-2xl font-bold" data-testid="metric-sales-today">
                {formatCurrency(summary?.totalSalesToday || 0)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-12 mt-1" />
            ) : (
              <div className="text-2xl font-bold" data-testid="metric-active-employees">
                {summary?.activeEmployees || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-12 mt-1" />
            ) : (
              <div className="text-2xl font-bold text-destructive" data-testid="metric-low-stock">
                {summary?.lowStockItems || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-12 mt-1" />
            ) : (
              <div className="text-2xl font-bold" data-testid="metric-pending-time">
                {summary?.pendingTimeEntries || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : summary?.recentOrders && summary.recentOrders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentOrders.map((order) => (
                    <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                      <TableCell className="font-medium">#{order.id}</TableCell>
                      <TableCell className="capitalize">{order.orderType}</TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(order.createdAt), "MMM d, h:mm a")}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed">
                <div className="text-center text-muted-foreground">
                  <p>No recent orders found</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer" data-testid="action-new-order">
                <ShoppingBag className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">New Order</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer" data-testid="action-add-item">
                <Package className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">Add Item</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer" data-testid="action-new-employee">
                <Users className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">Add Employee</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
