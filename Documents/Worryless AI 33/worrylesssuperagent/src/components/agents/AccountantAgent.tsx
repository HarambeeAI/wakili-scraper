import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, TrendingUp, TrendingDown, DollarSign, Image, Eye, FileSpreadsheet, Trash2, Loader2, Table, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Inline Json type (previously imported from supabase types)
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type Invoice = {
  id: string;
  vendor_name: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: string;
  description: string | null;
  created_at: string;
  image_url: string | null;
};

type Transaction = {
  id: string;
  type: string;
  amount: number;
  category: string | null;
  description: string | null;
  date: string;
};

type Datasheet = {
  id: string;
  name: string;
  description: string;
  file_name: string;
  column_names: string[];
  row_count: number;
  created_at: string;
};

type DatasheetRow = {
  id: string;
  row_data: Json;
  row_index: number;
};

type DateRange = {
  label: string;
  startDate: Date;
  endDate: Date;
};

// Helper to format date range display
const formatDateRange = (start: Date, end: Date) => {
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${formatDate(start)} - ${formatDate(end)}`;
};

// Extract available date ranges from datasheet rows
const extractAvailableDateRanges = (rows: DatasheetRow[]): DateRange[] => {
  const datePatterns = ['date', 'transaction_date', 'created', 'period', 'time', 'timestamp', 'day', 'month'];
  const dates: Date[] = [];

  rows.forEach((row) => {
    const data = row.row_data;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return;

    const rowData = data as Record<string, Json | undefined>;

    for (const key of Object.keys(rowData)) {
      const lowerKey = key.toLowerCase();
      if (datePatterns.some(p => lowerKey.includes(p))) {
        const val = rowData[key];
        if (val && typeof val === 'string') {
          const parsed = new Date(val);
          if (!isNaN(parsed.getTime())) {
            dates.push(parsed);
          }
        }
      }
    }
  });

  if (dates.length === 0) return [];

  dates.sort((a, b) => a.getTime() - b.getTime());

  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  // Generate quarterly ranges within the data span
  const ranges: DateRange[] = [];

  // Add "All Time" option first
  ranges.push({
    label: 'All Time',
    startDate: minDate,
    endDate: maxDate,
  });

  // Generate quarters
  let currentYear = minDate.getFullYear();
  let currentQuarter = Math.floor(minDate.getMonth() / 3);

  while (true) {
    const quarterStart = new Date(currentYear, currentQuarter * 3, 1);
    const quarterEnd = new Date(currentYear, (currentQuarter + 1) * 3, 0);

    if (quarterStart > maxDate) break;

    if (quarterEnd >= minDate) {
      ranges.push({
        label: `Q${currentQuarter + 1} ${currentYear}`,
        startDate: quarterStart,
        endDate: quarterEnd,
      });
    }

    currentQuarter++;
    if (currentQuarter > 3) {
      currentQuarter = 0;
      currentYear++;
    }
  }

  return ranges;
};

export function AccountantAgent() {
  const { token, userId } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [datasheets, setDatasheets] = useState<Datasheet[]>([]);
  const [datasheetRows, setDatasheetRows] = useState<DatasheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [datasheetDialogOpen, setDatasheetDialogOpen] = useState(false);
  const [uploadingDatasheet, setUploadingDatasheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [newInvoice, setNewInvoice] = useState({
    vendor_name: "",
    amount: "",
    due_date: "",
    description: "",
  });

  const [newDatasheet, setNewDatasheet] = useState({
    name: "",
    description: "",
    file: null as File | null,
  });

  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [invoicesData, transactionsData, datasheetsData, datasheetRowsData] = await Promise.all([
        api.get<Invoice[]>("/api/invoices", { token: token! }),
        api.get<Transaction[]>("/api/transactions", { token: token! }),
        api.get<Datasheet[]>("/api/user-datasheets", { token: token! }),
        api.get<DatasheetRow[]>("/api/datasheet-rows", { token: token! }),
      ]);

      if (invoicesData) setInvoices(invoicesData);
      if (transactionsData) setTransactions(transactionsData);
      if (datasheetsData) setDatasheets(datasheetsData);
      if (datasheetRowsData) setDatasheetRows(datasheetRowsData);
    } catch (err) {
      console.error("Error fetching accountant data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInvoice = async () => {
    try {
      await api.post("/api/invoices", {
        vendor_name: newInvoice.vendor_name,
        amount: parseFloat(newInvoice.amount),
        due_date: newInvoice.due_date || null,
        description: newInvoice.description || null,
      }, { token: token! });

      toast({ title: "Success", description: "Invoice added" });
      setDialogOpen(false);
      setNewInvoice({ vendor_name: "", amount: "", due_date: "", description: "" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/tab-separated-values"
      ];
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (!validTypes.includes(file.type) && !['csv', 'xlsx', 'xls', 'tsv', 'txt'].includes(extension || '')) {
        toast({ title: "Invalid file type", description: "Please upload a CSV, TSV, or Excel file", variant: "destructive" });
        return;
      }

      setNewDatasheet(prev => ({ ...prev, file }));
    }
  };

  const handleUploadDatasheet = async () => {
    if (!newDatasheet.file || !newDatasheet.name || !newDatasheet.description) {
      toast({ title: "Missing fields", description: "Please fill in all fields and select a file", variant: "destructive" });
      return;
    }

    setUploadingDatasheet(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL;

      // Upload file to server storage via multipart form
      const formData = new FormData();
      formData.append("file", newDatasheet.file);
      formData.append("userId", userId ?? "");

      const uploadRes = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }

      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.url as string;

      // Call the parse-datasheet edge function
      const parseData = await api.post<{
        error?: string;
        suggestion?: string;
        datasheet?: { id: string; name: string; rowCount: number; columnNames: string[] };
      }>("/api/parse-datasheet", {
        fileUrl,
        fileName: newDatasheet.file.name,
        name: newDatasheet.name,
        description: newDatasheet.description,
        userId,
      }, { token: token! });

      if (parseData?.error) {
        if (parseData.suggestion === "csv_required") {
          toast({
            title: "CSV Format Required",
            description: parseData.error,
            variant: "destructive",
          });
        } else {
          throw new Error(parseData.error);
        }
        return;
      }

      toast({
        title: "Datasheet uploaded",
        description: `Successfully imported ${parseData?.datasheet?.rowCount} rows from "${parseData?.datasheet?.name}"`,
      });

      // Also save to business_artifacts for AI context
      await api.post("/api/artifacts", {
        artifact_type: "uploaded_document",
        title: newDatasheet.name,
        content: `Data Sheet: ${newDatasheet.name}\nDescription: ${newDatasheet.description}\nColumns: ${parseData?.datasheet?.columnNames?.join(", ")}\nRows: ${parseData?.datasheet?.rowCount}`,
        source_url: fileUrl,
        metadata: {
          datasheet_id: parseData?.datasheet?.id,
          file_type: newDatasheet.file.type,
          column_names: parseData?.datasheet?.columnNames,
          row_count: parseData?.datasheet?.rowCount,
          uploaded_via: "accountant",
        }
      }, { token: token! });

      setDatasheetDialogOpen(false);
      setNewDatasheet({ name: "", description: "", file: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchData();

    } catch (error) {
      console.error("Datasheet upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploadingDatasheet(false);
    }
  };

  const handleDeleteDatasheet = async (id: string) => {
    try {
      await api.delete(`/api/user-datasheets/${id}`, { token: token! });
      toast({ title: "Deleted", description: "Datasheet removed" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const updateInvoiceStatus = async (id: string, status: "pending" | "paid" | "overdue" | "cancelled") => {
    try {
      await api.patch(`/api/invoices/${id}`, { status }, { token: token! });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Calculate metrics from transactions
  const transactionIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const transactionExpenses = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const pendingAmount = invoices.filter((i) => i.status === "pending").reduce((sum, i) => sum + Number(i.amount), 0);

  // Get available date ranges from datasheet data
  const availableDateRanges = extractAvailableDateRanges(datasheetRows);

  // Get selected date range object
  const getSelectedRange = (): DateRange | null => {
    if (selectedDateRange === 'all' || availableDateRanges.length === 0) {
      return availableDateRanges.find(r => r.label === 'All Time') || null;
    }
    return availableDateRanges.find(r => r.label === selectedDateRange) || null;
  };

  const currentRange = getSelectedRange();

  // Extract financial data from uploaded datasheets with date filtering
  const extractDatasheetMetrics = (filterRange: DateRange | null) => {
    let income = 0;
    let expenses = 0;

    // Common column name patterns for financial data
    const incomePatterns = ['income', 'revenue', 'sales', 'credit', 'deposit', 'received'];
    const expensePatterns = ['expense', 'cost', 'debit', 'payment', 'withdrawal', 'spent'];
    const amountPatterns = ['amount', 'value', 'total', 'sum', 'price'];
    const typePatterns = ['type', 'category', 'transaction_type', 'kind'];
    const datePatterns = ['date', 'transaction_date', 'created', 'period', 'time', 'timestamp', 'day'];

    datasheetRows.forEach((row) => {
      const data = row.row_data;

      // Skip if data is not an object
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return;

      const rowData = data as Record<string, Json | undefined>;

      // Check date filter
      if (filterRange) {
        let rowDate: Date | null = null;
        for (const key of Object.keys(rowData)) {
          const lowerKey = key.toLowerCase();
          if (datePatterns.some(p => lowerKey.includes(p))) {
            const val = rowData[key];
            if (val && typeof val === 'string') {
              const parsed = new Date(val);
              if (!isNaN(parsed.getTime())) {
                rowDate = parsed;
                break;
              }
            }
          }
        }

        // Skip rows outside the selected date range
        if (rowDate && (rowDate < filterRange.startDate || rowDate > filterRange.endDate)) {
          return;
        }
      }

      // Find amount column
      let amountValue = 0;
      for (const pattern of amountPatterns) {
        const matchingKey = Object.keys(rowData).find(k => k.toLowerCase().includes(pattern));
        if (matchingKey && rowData[matchingKey] !== null && rowData[matchingKey] !== undefined) {
          const val = parseFloat(String(rowData[matchingKey]).replace(/[^0-9.-]/g, ''));
          if (!isNaN(val)) {
            amountValue = Math.abs(val);
            break;
          }
        }
      }

      // Try to determine if income or expense
      // Check if there's a type column
      const typeKey = Object.keys(rowData).find(k =>
        typePatterns.some(p => k.toLowerCase().includes(p))
      );

      if (typeKey && rowData[typeKey]) {
        const typeValue = String(rowData[typeKey]).toLowerCase();
        if (incomePatterns.some(p => typeValue.includes(p))) {
          income += amountValue;
        } else if (expensePatterns.some(p => typeValue.includes(p))) {
          expenses += amountValue;
        }
      } else {
        // Check column names for income/expense indicators
        for (const key of Object.keys(rowData)) {
          const lowerKey = key.toLowerCase();
          const val = rowData[key];

          if (val !== null && val !== undefined) {
            const numVal = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
            if (!isNaN(numVal) && numVal !== 0) {
              if (incomePatterns.some(p => lowerKey.includes(p))) {
                income += Math.abs(numVal);
              } else if (expensePatterns.some(p => lowerKey.includes(p))) {
                expenses += Math.abs(numVal);
              }
            }
          }
        }
      }
    });

    return { income, expenses };
  };

  const datasheetMetrics = extractDatasheetMetrics(currentRange);

  // Combine all sources
  const totalIncome = transactionIncome + datasheetMetrics.income;
  const totalExpenses = transactionExpenses + datasheetMetrics.expenses;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-500/10 text-green-600";
      case "pending": return "bg-yellow-500/10 text-yellow-600";
      case "overdue": return "bg-red-500/10 text-red-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Accountant</h1>
          <p className="text-muted-foreground">Tracks income and expenses, manages invoices, generates financial reports, and alerts you to cash-flow or budget risks.</p>
        </div>
        <div className="flex gap-2">
          {/* Upload Datasheet Dialog */}
          <Dialog open={datasheetDialogOpen} onOpenChange={setDatasheetDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Upload Datasheet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Financial Datasheet</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>File (CSV format recommended)</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx,.xls"
                    onChange={handleFileSelect}
                  />
                  {newDatasheet.file && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {newDatasheet.file.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    CSV files work best. For Excel files, please save as CSV first.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Sheet Name *</Label>
                  <Input
                    value={newDatasheet.name}
                    onChange={(e) => setNewDatasheet({ ...newDatasheet, name: e.target.value })}
                    placeholder="e.g., Q4 2024 Expenses"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea
                    value={newDatasheet.description}
                    onChange={(e) => setNewDatasheet({ ...newDatasheet, description: e.target.value })}
                    placeholder="Describe what this data contains (e.g., 'Monthly expenses with vendor, amount, date, and category columns')"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    This helps the AI understand your data and answer questions about it.
                  </p>
                </div>
                <Button
                  onClick={handleUploadDatasheet}
                  className="w-full"
                  disabled={uploadingDatasheet || !newDatasheet.file || !newDatasheet.name || !newDatasheet.description}
                >
                  {uploadingDatasheet ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Upload & Process"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Invoice Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Add Invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Vendor Name</Label>
                  <Input
                    value={newInvoice.vendor_name}
                    onChange={(e) => setNewInvoice({ ...newInvoice, vendor_name: e.target.value })}
                    placeholder="Company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newInvoice.description}
                    onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })}
                    placeholder="Invoice details"
                  />
                </div>
                <Button onClick={handleAddInvoice} className="w-full">Add Invoice</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Period:</span>
          </div>

          {availableDateRanges.length > 0 ? (
            <>
              <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  {availableDateRanges
                    .filter(r => r.label !== 'All Time')
                    .map((range) => (
                      <SelectItem key={range.label} value={range.label}>
                        {range.label}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              {currentRange && (
                <span className="text-xs text-muted-foreground">
                  {formatDateRange(currentRange.startDate, currentRange.endDate)}
                </span>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-xs">
              Upload datasheets with dates to enable filtering
            </Badge>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Income</p>
                  <p className="text-2xl font-bold">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  {datasheetMetrics.income > 0 && (
                    <p className="text-xs text-muted-foreground">includes ${datasheetMetrics.income.toLocaleString()} from datasheets</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold">${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  {datasheetMetrics.expenses > 0 && (
                    <p className="text-xs text-muted-foreground">includes ${datasheetMetrics.expenses.toLocaleString()} from datasheets</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Invoices</p>
                  <p className="text-2xl font-bold">${pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* My Datasheets Section */}
      {datasheets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5" />
              My Datasheets
            </CardTitle>
            <CardDescription>Your uploaded financial data for AI analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {datasheets.map((sheet) => (
                <div key={sheet.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{sheet.name}</p>
                      <p className="text-sm text-muted-foreground">{sheet.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {sheet.row_count} rows
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {sheet.column_names.length} columns
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {sheet.column_names.slice(0, 3).join(", ")}{sheet.column_names.length > 3 ? "..." : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteDatasheet(sheet.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Manage your invoices and track payments</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No invoices yet. Add your first invoice to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-start gap-4">
                    {invoice.image_url && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="relative group shrink-0">
                            <img
                              src={invoice.image_url}
                              alt="Invoice preview"
                              className="w-16 h-20 object-cover rounded border shadow-sm"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                              <Eye className="h-4 w-4 text-white" />
                            </div>
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Invoice - {invoice.vendor_name}</DialogTitle>
                          </DialogHeader>
                          <div className="mt-4">
                            <img
                              src={invoice.image_url}
                              alt="Invoice"
                              className="w-full rounded-lg border"
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    <div className="space-y-1">
                      <p className="font-medium">{invoice.vendor_name}</p>
                      <p className="text-sm text-muted-foreground">{invoice.description}</p>
                      {invoice.due_date && (
                        <p className="text-xs text-muted-foreground">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
                      )}
                      {invoice.image_url && (
                        <Badge variant="outline" className="text-xs">
                          <Image className="h-3 w-3 mr-1" />
                          AI Generated
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold">${Number(invoice.amount).toFixed(2)}</p>
                    <Select
                      value={invoice.status}
                      onValueChange={(value) => updateInvoiceStatus(invoice.id, value as "pending" | "paid" | "overdue" | "cancelled")}
                    >
                      <SelectTrigger className={`w-32 ${getStatusColor(invoice.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
