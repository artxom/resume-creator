import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Box,
  Snackbar,
  Alert,
  Button
} from '@mui/material';
import type { GridColDef, GridRowId, GridRowModesModel, GridEventListener } from '@mui/x-data-grid';
import { GridRowModes, DataGrid, GridActionsCellItem, GridRowEditStopReasons } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';


const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const DataManager: React.FC = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [pkColumn, setPkColumn] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});

  // Fetch list of tables
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/data/tables`);
        const data = await response.json();
        setTables(data.tables || []);
      } catch (err) {
        setSnackbar({ open: true, message: 'Failed to fetch tables.', severity: 'error' });
      }
    };
    fetchTables();
  }, []);

  // Fetch data for selected table
  useEffect(() => {
    if (!selectedTable) {
      setRows([]);
      setPkColumn(null);
      return;
    }
    const fetchTableData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/data/tables/${selectedTable}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch table data.');
        }
        const data = await response.json();
        // Add a temporary, stable ID for DataGrid if no primary key is found
        const rowsWithId = data.data.map((r: any, index: number) => ({ ...r, _gridId: index }));
        setRows(rowsWithId);
        setPkColumn(data.pk_column || null);
      } catch (err) {
        setSnackbar({ open: true, message: (err as Error).message, severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchTableData();
  }, [selectedTable]);

  const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleSaveClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
  };

  const handleDeleteClick = (id: GridRowId) => async () => {
    if (!pkColumn || !selectedTable) return;
    
    if (!window.confirm(`Are you sure you want to delete row with ${pkColumn}=${id}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/data/tables/${selectedTable}/row`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { [pkColumn]: id } }),
        });
        if (!response.ok) throw new Error('Deletion failed');
        
        setRows(rows.filter((row) => row[pkColumn] !== id));
        setSnackbar({ open: true, message: 'Row deleted successfully.', severity: 'success' });
    } catch (err) {
        setSnackbar({ open: true, message: 'Failed to delete row.', severity: 'error' });
    }
  };

  const handleCancelClick = (id: GridRowId) => () => {
    setRowModesModel({
      ...rowModesModel,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    });
  };

  const handleDeleteTable = async () => {
    if (!selectedTable) return;
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete the table "${selectedTable}"? This action cannot be undone.`)) {
        return;
    }

    setLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/data/tables/${selectedTable}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete table.');
        }

        setSnackbar({ open: true, message: `Table "${selectedTable}" deleted successfully.`, severity: 'success' });
        setSelectedTable(''); // Clear selection
        // Refresh table list
        const tableRes = await fetch(`${API_BASE_URL}/data/tables`);
        const tableData = await tableRes.json();
        setTables(tableData.tables || []);
    } catch (err) {
        setSnackbar({ open: true, message: (err as Error).message, severity: 'error' });
    } finally {
        setLoading(false);
    }
  };

  const processRowUpdate = useCallback(async (newRow: any, oldRow: any) => {
    if (!pkColumn || !selectedTable) throw new Error("Table has no primary key, cannot update.");

    try {
        const response = await fetch(`${API_BASE_URL}/data/tables/${selectedTable}/row`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: newRow }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Update failed');
        }
        
        setSnackbar({ open: true, message: 'Row updated successfully!', severity: 'success' });
        return newRow;
    } catch (err) {
        setSnackbar({ open: true, message: (err as Error).message, severity: 'error' });
        return oldRow; // Revert changes on error
    }
  }, [pkColumn, selectedTable]);

  const columns: GridColDef[] = rows.length > 0
    ? [
        ...Object.keys(rows[0])
          .filter(key => key !== '_gridId' && key !== 'id') // Hide 'id' and internal '_gridId'
          .map((key) => ({
          field: key,
          headerName: key.toUpperCase(),
          flex: 1,
          minWidth: 150,
          editable: pkColumn ? key !== pkColumn : false, // Only allow editing if PK exists
        })),
        ...(pkColumn ? [{
          field: 'actions',
          type: 'actions' as any, // Cast to any or GridColType to fix type error
          headerName: 'Actions',
          width: 100,
          cellClassName: 'actions',
          getActions: ({ id }: { id: GridRowId }) => {
            const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;
            if (isInEditMode) {
              return [
                <GridActionsCellItem icon={<SaveIcon />} label="Save" onClick={handleSaveClick(id)} />,
                <GridActionsCellItem icon={<CancelIcon />} label="Cancel" onClick={handleCancelClick(id)} />,
              ];
            }
            return [
              <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={handleEditClick(id)} />,
              <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={handleDeleteClick(id)} />,
            ];
          },
        }] : []),
      ]
    : [];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, height: '80vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Data Manager
      </Typography>

      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl fullWidth>
          <InputLabel id="table-select-label">Select a Table</InputLabel>
          <Select
            labelId="table-select-label"
            value={selectedTable}
            label="Select a Table"
            onChange={(e) => setSelectedTable(e.target.value as string)}
          >
            {tables.map((table) => (
              <MenuItem key={table} value={table}>
                {table}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteForeverIcon />}
          onClick={handleDeleteTable}
          disabled={!selectedTable || loading}
          sx={{ height: 56, whiteSpace: 'nowrap' }}
        >
          Delete Table
        </Button>
      </Box>

      <Box sx={{ flexGrow: 1, height: '100%', width: '100%' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(row) => pkColumn ? row[pkColumn] : row._gridId}
            editMode="row"
            rowModesModel={rowModesModel}
            onRowModesModelChange={setRowModesModel}
            onRowEditStop={handleRowEditStop}
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={(error) => setSnackbar({ open: true, message: error.message, severity: 'error' })}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        )}
      </Box>

      {snackbar && (
        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
};

export default DataManager;
