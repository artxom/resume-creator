import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  CircularProgress,
  Grid,
  Chip
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface MappingData {
  [key: string]: string; // placeholder -> column
}

interface TableColumnMap {
  [tableName: string]: string[];
}

const FieldMapper: React.FC = () => {
  const [tables, setTables] = useState<string[]>([]);
  
  // Selection States
  const [personTable, setPersonTable] = useState<string>('');
  const [projectTable, setProjectTable] = useState<string>('');
  
  // Data States
  const [tableColumns, setTableColumns] = useState<TableColumnMap>({});
  
  // Template States
  const [singletonPlaceholders, setSingletonPlaceholders] = useState<string[]>([]);
  const [loopPlaceholders, setLoopPlaceholders] = useState<string[]>([]);
  const [templateParsed, setTemplateParsed] = useState<boolean>(false);
  
  // Mappings
  const [personMapping, setPersonMapping] = useState<MappingData>({});
  const [projectMapping, setProjectMapping] = useState<MappingData>({});

  // UI States
  const [saving, setSaving] = useState<boolean>(false);
  const [parsing, setParsing] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  // 1. Initialize: Fetch tables
  useEffect(() => {
    fetch(`${API_BASE_URL}/data/tables`)
      .then(res => res.json())
      .then(data => setTables(data.tables || []))
      .catch(() => setSnackbar({ open: true, message: '初始化数据失败', severity: 'error' }));
  }, []);

  // 2. Helper to fetch columns for a table
  const fetchColumns = async (tableName: string) => {
    if (!tableName || tableColumns[tableName]) return;
    try {
      const res = await fetch(`${API_BASE_URL}/data/tables/${tableName}`);
      const data = await res.json();
      const cols = (data.columns || []).filter((k: string) => k !== 'id' && k !== '_gridId');
      setTableColumns(prev => ({ ...prev, [tableName]: cols }));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (personTable) fetchColumns(personTable);
  }, [personTable]);

  useEffect(() => {
    if (projectTable) fetchColumns(projectTable);
  }, [projectTable]);

  // 3. Handle Template Upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setParsing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/templates/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to parse template');
      const data = await response.json();
      
      setSingletonPlaceholders(data.singleton_placeholders || []);
      setLoopPlaceholders(data.loop_placeholders || []);
      setTemplateParsed(true);
      setSnackbar({ open: true, message: '模板解析成功！', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: '模板解析失败', severity: 'error' });
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!personTable && !projectTable) {
        setSnackbar({ open: true, message: '请至少选择一个数据源表', severity: 'error' });
        return;
    }
    
    setSaving(true);
    try {
      // Save Person Mapping (if table selected)
      if (personTable) {
          await fetch(`${API_BASE_URL}/mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table_name: personTable,
              mapping_data: personMapping
            })
          });
      }

      // Save Project Mapping (if table selected and different from person table, or same)
      // Note: If tables are same, we merge mappings or handle carefully. 
      // For simplicity here, we treat them as separate configurations per table.
      if (projectTable && projectTable !== personTable) {
          await fetch(`${API_BASE_URL}/mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table_name: projectTable,
                mapping_data: projectMapping
            })
          });
      } else if (projectTable && projectTable === personTable) {
          // If same table, merge mappings and save once
          const merged = { ...personMapping, ...projectMapping };
          await fetch(`${API_BASE_URL}/mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table_name: personTable,
                mapping_data: merged
            })
          });
      }

      setSnackbar({ open: true, message: '所有映射已保存！', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: '保存映射失败', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        模板字段映射
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
        上传 Word 模板，解析占位符，并将其映射到数据库字段。
      </Typography>

      {/* Step 1: Upload Template */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
            第一步：上传 Word 模板
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                size="large"
            >
                选择 .docx 文件
                <input type="file" hidden accept=".docx" onChange={handleFileUpload} />
            </Button>
            {parsing && <CircularProgress size={24} />}
            {templateParsed && <Chip label="模板解析成功" color="success" variant="outlined" />}
        </Box>
      </Paper>

      {templateParsed && (
        <>
            <Grid container spacing={3}>
                {/* Step 2A: Person Mapping */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            👤 人员详情映射
                            <Chip size="small" label={`${singletonPlaceholders.length} 个字段`} />
                        </Typography>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>选择数据源 (人员表)</InputLabel>
                            <Select
                                value={personTable}
                                label="选择数据源 (人员表)"
                                onChange={(e) => setPersonTable(e.target.value as string)}
                            >
                                {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                            </Select>
                        </FormControl>

                        {personTable && (
                            <TableContainer sx={{ maxHeight: 400 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>模板占位符</TableCell>
                                            <TableCell>对应数据列</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {singletonPlaceholders.map(p => (
                                            <TableRow key={p}>
                                                <TableCell sx={{ fontFamily: 'monospace' }}>{`{{ ${p} }}`}</TableCell>
                                                <TableCell>
                                                    <Select
                                                        fullWidth
                                                        size="small"
                                                        value={personMapping[p] || ''}
                                                        displayEmpty
                                                        onChange={(e) => setPersonMapping(prev => ({...prev, [p]: e.target.value as string}))}
                                                    >
                                                        <MenuItem value=""><em>未映射</em></MenuItem>
                                                        {(tableColumns[personTable] || []).map(col => (
                                                            <MenuItem key={col} value={col}>{col}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                </Grid>

                {/* Step 2B: Project Mapping */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            🏗️ 项目列表映射 (循环)
                            <Chip size="small" label={`${loopPlaceholders.length} 个字段`} />
                        </Typography>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>选择数据源 (项目表)</InputLabel>
                            <Select
                                value={projectTable}
                                label="选择数据源 (项目表)"
                                onChange={(e) => setProjectTable(e.target.value as string)}
                            >
                                {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                            </Select>
                        </FormControl>

                        {projectTable && (
                            <TableContainer sx={{ maxHeight: 400 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>模板占位符</TableCell>
                                            <TableCell>对应数据列</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loopPlaceholders.map(p => (
                                            <TableRow key={p}>
                                                <TableCell sx={{ fontFamily: 'monospace' }}>{`{{ ${p} }}`}</TableCell>
                                                <TableCell>
                                                    <Select
                                                        fullWidth
                                                        size="small"
                                                        value={projectMapping[p] || ''}
                                                        displayEmpty
                                                        onChange={(e) => setProjectMapping(prev => ({...prev, [p]: e.target.value as string}))}
                                                    >
                                                        <MenuItem value=""><em>未映射</em></MenuItem>
                                                        {(tableColumns[projectTable] || []).map(col => (
                                                            <MenuItem key={col} value={col}>{col}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                    size="large"
                >
                    {saving ? '保存中...' : '保存所有映射'}
                </Button>
            </Box>
        </>
      )}

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

export default FieldMapper;
