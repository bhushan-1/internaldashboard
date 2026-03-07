import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  title?: string;
  data: T[];
  columns: Column<T>[];
  className?: string;
}

export function DataTable<T extends object>({ 
  title, 
  data, 
  columns,
  className 
}: DataTableProps<T>) {
  return (
    <Card className={cn("border-2 border-border", className)}>
      {title && (
        <CardHeader className="border-b-2 border-border">
          <CardTitle className="font-mono text-sm uppercase tracking-wider">
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-border hover:bg-transparent">
              {columns.map((column) => (
                <TableHead 
                  key={String(column.key)} 
                  className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-12"
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow 
                key={index} 
                className="border-b border-border/50 hover:bg-accent/50"
              >
                {columns.map((column) => (
                  <TableCell key={String(column.key)} className="py-3">
                    {column.render 
                      ? column.render(item) 
                      : String(item[column.key as keyof T] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell 
                  colSpan={columns.length} 
                  className="text-center py-8 text-muted-foreground"
                >
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
