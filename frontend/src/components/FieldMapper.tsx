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
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  TextField,
  Divider,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Card,
  CardContent,
  Tab,
  Tabs,
  Badge,
  Grid,
  ListItemButton,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface Template {
    id: number;
    name: string;
    filename: string;
}

interface MappingData {
  [key: string]: string; // placeholder -> column
}

interface AIInstruction {
  length: string;
  format: string;
  description: string;
  other: string;
}

interface AIInstructionsMap {
  [key: string]: AIInstruction;
}

interface TableColumnMap {
  [tableName: string]: string[];
}

const FieldMapper: React.FC = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  
  // Selection States
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
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

  // AI Instructions
  const [personAI, setPersonAI] = useState<AIInstructionsMap>({});
  const [projectAI, setProjectAI] = useState<AIInstructionsMap>({});

  // UI States
  const [activeTab, setActiveTab] = useState(0); // 0: Person, 1: Project
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  // Action Dialog States
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'copy' | 'rename'>('copy');
  const [actionValue, setActionValue] = useState('');
  const [actionTargetId, setActionTargetId] = useState<number | null>(null);

  // Initial Data Load
  useEffect(() => {
    fetchTables();
    fetchTemplates();
  }, []);

  const fetchTables = () => {
    fetch(`${API_BASE_URL}/data/tables`)
      .then(res => res.json())
      .then(data => setTables(data.tables || []))
      .catch(() => showMsg('Failed to load tables', 'error'));
  };

  const fetchTemplates = () => {
      fetch(`${API_BASE_URL}/templates`)
        .then(res => res.json())
        .then(data => setTemplates(data))
        .catch(() => showMsg('Failed to load templates', 'error'));
  };

  const showMsg = (msg: string, severity: 'success' | 'error') => {
      setSnackbar({ open: true, message: msg, severity });
  };

  // Fetch columns for a table
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

  // Load Template Data when selected
  const handleTemplateSelect = async (templateId: number) => {
      setSelectedTemplateId(templateId);
      setLoading(true);
      setTemplateParsed(false);
      
      // Reset State
      setPersonTable('');
      setProjectTable('');
      setPersonMapping({});
      setProjectMapping({});
      setPersonAI({});
      setProjectAI({});

      try {
          // 1. Parse Template
          const parseRes = await fetch(`${API_BASE_URL}/templates/${templateId}/parse`);
          if (!parseRes.ok) throw new Error("Failed to parse template");
          const parseData = await parseRes.json();
          
          setSingletonPlaceholders(parseData.singleton_placeholders || []);
          setLoopPlaceholders(parseData.loop_placeholders || []);
          
          // 2. Load Existing Mappings
          const mapRes = await fetch(`${API_BASE_URL}/templates/${templateId}/mappings`);
          if (mapRes.ok) {
              const mappings = await mapRes.json();
              // Heuristic to distribute mappings to Person/Project slots
              // We check if keys overlap with singleton or loop placeholders
              const singletons = new Set(parseData.singleton_placeholders || []);
              
              mappings.forEach((m: any) => {
                  const keys = Object.keys(m.mapping_data || {});
                  const isPerson = keys.some(k => singletons.has(k));
                  
                  // If it has singleton keys, it's likely the person table.
                  // Otherwise, if it has loop keys (or startswith p.), it's project.
                  // Fallback: Just put it in Person if empty, else Project.
                  
                  if (isPerson || !personTable) {
                      setPersonTable(m.table_name);
                      setPersonMapping(m.mapping_data || {});
                      setPersonAI(m.ai_instructions || {});
                      fetchColumns(m.table_name);
                  } else {
                      setProjectTable(m.table_name);
                      setProjectMapping(m.mapping_data || {});
                      setProjectAI(m.ai_instructions || {});
                      fetchColumns(m.table_name);
                  }
              });
          }

          setTemplateParsed(true);
          // Auto select first field
          if (parseData.singleton_placeholders?.length > 0) {
              setSelectedField(parseData.singleton_placeholders[0]);
              setActiveTab(0);
          } else if (parseData.loop_placeholders?.length > 0) {
              setSelectedField(parseData.loop_placeholders[0]);
              setActiveTab(1);
          }

      } catch (err) {
          showMsg('Failed to load template data', 'error');
      } finally {
          setLoading(false);
      }
  };

  const handleUploadTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/templates`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error("Upload failed");
        const newTemplate = await res.json();
        setTemplates(prev => [...prev, newTemplate]);
        handleTemplateSelect(newTemplate.id);
        showMsg('Template uploaded successfully', 'success');
    } catch (err) {
        showMsg('Upload failed', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this template?")) return;
      
      try {
          const res = await fetch(`${API_BASE_URL}/templates/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error("Delete failed");
          setTemplates(prev => prev.filter(t => t.id !== id));
          if (selectedTemplateId === id) {
              setSelectedTemplateId(null);
              setTemplateParsed(false);
          }
          showMsg('Template deleted', 'success');
      } catch (err) {
          showMsg('Delete failed', 'error');
      }
  };

  const handleOpenActionDialog = (e: React.MouseEvent, type: 'copy' | 'rename', template: Template) => {
      e.stopPropagation();
      setActionType(type);
      setActionTargetId(template.id);
      setActionValue(type === 'copy' ? `${template.name} (Copy)` : template.name);
      setActionDialogOpen(true);
  };

  const handleActionSubmit = async () => {
      if (!actionTargetId || !actionValue.trim()) return;
      setLoading(true);
      try {
          const endpoint = actionType === 'copy' ? 'copy' : 'rename';
          const method = actionType === 'copy' ? 'POST' : 'PUT';
          
          const res = await fetch(`${API_BASE_URL}/templates/${actionTargetId}/${endpoint}`, {
              method: method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ new_name: actionValue })
          });

          if (!res.ok) {
              const err = await res.json();
              throw new Error(err.detail || 'Operation failed');
          }

          const result = await res.json();
          
          if (actionType === 'copy') {
              setTemplates(prev => [...prev, result]);
              showMsg('Template copied successfully', 'success');
          } else {
              setTemplates(prev => prev.map(t => t.id === result.id ? result : t));
              showMsg('Template renamed successfully', 'success');
          }
          setActionDialogOpen(false);
      } catch (error: any) {
          showMsg(error.message, 'error');
      } finally {
          setLoading(false);
      }
  };

  const handleSave = async () => {
    if (!selectedTemplateId) return;
    if (!personTable && !projectTable) {
        showMsg('请至少选择一个数据源表', 'error');
        return;
    }
    
    setSaving(true);
    try {
      if (personTable) {
          await saveMappingRequest(personTable, personMapping, personAI);
      }
      if (projectTable && projectTable !== personTable) {
          await saveMappingRequest(projectTable, projectMapping, projectAI);
      } else if (projectTable && projectTable === personTable) {
          // Merge if same table
          const mergedMapping = { ...personMapping, ...projectMapping };
          const mergedAI = { ...personAI, ...projectAI };
          await saveMappingRequest(personTable, mergedMapping, mergedAI);
      }

      showMsg('Configuration saved!', 'success');
    } catch (err) {
      showMsg('Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveMappingRequest = async (tableName: string, mapData: MappingData, aiData: AIInstructionsMap) => {
      await fetch(`${API_BASE_URL}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplateId,
          table_name: tableName,
          mapping_data: mapData,
          ai_instructions: aiData
        })
      });
  };

  const updateAIInstruction = (
    placeholder: string, 
    field: keyof AIInstruction, 
    value: string, 
    setAI: React.Dispatch<React.SetStateAction<AIInstructionsMap>>
  ) => {
      setAI(prev => ({
          ...prev,
          [placeholder]: {
              ...prev[placeholder],
              [field]: value
          }
      }));
  };

  // --- Render Helpers ---

  const renderSidebarItem = (p: string, mapping: MappingData, aiConfig: AIInstructionsMap) => {
    const isMapped = !!mapping[p];
    const hasAI = !!(aiConfig[p]?.description || aiConfig[p]?.length);
    const isSelected = selectedField === p;

    return (
        <ListItem key={p} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton 
                selected={isSelected}
                onClick={() => setSelectedField(p)}
                sx={{ 
                    borderRadius: 1, 
                    borderLeft: isSelected ? '4px solid #1976d2' : '4px solid transparent',
                    backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'transparent'
                }}
            >
                <ListItemIcon sx={{ minWidth: 36 }}>
                    {isMapped ? <CheckCircleIcon color="success" fontSize="small" /> : <ErrorOutlineIcon color="action" fontSize="small" />}
                </ListItemIcon>
                <ListItemText 
                    primary={<Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: isSelected ? 'bold' : 'normal' }}>{p}</Typography>}
                    secondary={hasAI ? <Stack direction="row" alignItems="center" spacing={0.5}><AutoFixHighIcon sx={{ fontSize: 12 }} color="primary"/><Typography variant="caption" color="primary">AI Enabled</Typography></Stack> : null}
                />
            </ListItemButton>
        </ListItem>
    );
  };

  const renderDetailPanel = () => {
      if (!selectedField) return <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>请从左侧选择一个字段进行配置</Box>;

      const isPersonMode = activeTab === 0;
      const currentTable = isPersonMode ? personTable : projectTable;
      const setTable = isPersonMode ? setPersonTable : setProjectTable;
      const mapping = isPersonMode ? personMapping : projectMapping;
      const setMapping = isPersonMode ? setPersonMapping : setProjectMapping;
      const aiConfig = isPersonMode ? personAI : projectAI;
      const setAIConfig = isPersonMode ? setPersonAI : setProjectAI;
      const tableLabel = isPersonMode ? "人员表" : "项目表";

      const currentMappedCol = mapping[selectedField] || '';
      const currentAI = aiConfig[selectedField] || { length: '', format: '', description: '', other: '' };

      const handleTableChange = (val: string) => {
          setTable(val);
          fetchColumns(val);
      };

      return (
          <Box sx={{ p: 0, height: '100%', overflowY: 'auto' }}>
              <Box sx={{ p: 3, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">正在配置字段</Typography>
                    <Typography variant="h5" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>{`{{ ${selectedField} }}`}</Typography>
                  </Box>
                  <Chip 
                    label={isPersonMode ? "单值字段 (Singleton)" : "循环字段 (Loop)"} 
                    color={isPersonMode ? "default" : "secondary"} 
                    variant="outlined" 
                    size="small"
                  />
              </Box>

              <Stack spacing={3} sx={{ p: 3 }}>
                  {/* Section 1: Data Source */}
                  <Card variant="outlined">
                      <CardContent>
                          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AssignmentIndIcon color="action" /> 数据源映射
                          </Typography>
                          <Divider sx={{ mb: 2 }} />
                          
                          <Grid container spacing={2}>
                              <Grid size={12}>
                                  <FormControl fullWidth size="small">
                                      <InputLabel>选择数据表 ({tableLabel})</InputLabel>
                                      <Select
                                          value={currentTable}
                                          label={`选择数据表 (${tableLabel})`}
                                          onChange={(e) => handleTableChange(e.target.value as string)}
                                      >
                                          {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                      </Select>
                                  </FormControl>
                              </Grid>
                              <Grid size={12}>
                                  <FormControl fullWidth size="small" disabled={!currentTable}>
                                      <InputLabel>对应数据库列</InputLabel>
                                      <Select
                                          value={currentMappedCol}
                                          label="对应数据库列"
                                          onChange={(e) => setMapping(prev => ({...prev, [selectedField]: e.target.value as string}))}
                                      >
                                          <MenuItem value=""><em>未映射 (或仅由 AI 生成)</em></MenuItem>
                                          {(tableColumns[currentTable] || []).map(col => (
                                              <MenuItem key={col} value={col}>{col}</MenuItem>
                                          ))}
                                      </Select>
                                  </FormControl>
                              </Grid>
                          </Grid>
                      </CardContent>
                  </Card>

                  {/* Section 2: AI Config */}
                  <Card variant="outlined" sx={{ bgcolor: '#fafafa' }}>
                      <CardContent>
                          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AutoFixHighIcon color="primary" /> AI 智能生成配置
                          </Typography>
                          <Divider sx={{ mb: 2 }} />
                          
                          <Grid container spacing={3}>
                              <Grid size={{ xs: 12, md: 4 }}>
                                  <TextField 
                                      fullWidth size="small" label="建议长度" 
                                      value={currentAI.length} 
                                      onChange={(e) => updateAIInstruction(selectedField, 'length', e.target.value, setAIConfig)}
                                  />
                              </Grid>
                              <Grid size={{ xs: 12, md: 4 }}>
                                  <TextField 
                                      fullWidth size="small" label="输出格式" 
                                      value={currentAI.format} 
                                      onChange={(e) => updateAIInstruction(selectedField, 'format', e.target.value, setAIConfig)}
                                  />
                              </Grid>
                              <Grid size={{ xs: 12, md: 4 }}>
                                  <TextField 
                                      fullWidth size="small" label="其他约束" 
                                      value={currentAI.other} 
                                      onChange={(e) => updateAIInstruction(selectedField, 'other', e.target.value, setAIConfig)}
                                  />
                              </Grid>
                              <Grid size={12}>
                                  <TextField 
                                      fullWidth multiline rows={5} label="核心描述与生成重点" 
                                      value={currentAI.description} 
                                      onChange={(e) => updateAIInstruction(selectedField, 'description', e.target.value, setAIConfig)}
                                  />
                              </Grid>
                          </Grid>
                      </CardContent>
                  </Card>
              </Stack>
          </Box>
      );
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
                智能字段映射 (Smart Mapper)
            </Typography>
            <Typography variant="body2" color="text.secondary">
                管理简历模板并配置字段映射。
            </Typography>
          </Box>
          <Box>
             {templateParsed && (
                <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving} sx={{ mr: 2 }}>
                    {saving ? '保存中...' : '保存配置'}
                </Button>
            )}
             <Button component="label" variant="outlined" startIcon={<AddIcon />}>
                添加新模板
                <input type="file" hidden accept=".docx" onChange={handleUploadTemplate} />
            </Button>
          </Box>
      </Box>

      {/* Main Content: Split View */}
      <Paper sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
          
          {/* Template List Sidebar */}
          <Box sx={{ width: 280, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', bgcolor: '#f9f9f9' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#fff' }}>
                  <Typography variant="subtitle2" color="text.secondary">TEMPLATE LIBRARY</Typography>
              </Box>
              <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
                  {templates.map(tpl => (
                      <ListItem 
                        key={tpl.id} 
                        disablePadding
                        secondaryAction={
                            <Stack direction="row" spacing={0}>
                                <IconButton aria-label="copy" size="small" onClick={(e) => handleOpenActionDialog(e, 'copy', tpl)}>
                                    <ContentCopyIcon fontSize="small" />
                                </IconButton>
                                <IconButton aria-label="rename" size="small" onClick={(e) => handleOpenActionDialog(e, 'rename', tpl)}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton edge="end" aria-label="delete" size="small" onClick={(e) => handleDeleteTemplate(e, tpl.id)}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Stack>
                        }
                      >
                          <ListItemButton selected={selectedTemplateId === tpl.id} onClick={() => handleTemplateSelect(tpl.id)}>
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                  <DescriptionIcon fontSize="small" color={selectedTemplateId === tpl.id ? "primary" : "action"} />
                              </ListItemIcon>
                              <ListItemText 
                                primary={tpl.name} 
                                primaryTypographyProps={{ variant: 'body2', noWrap: true, fontWeight: selectedTemplateId === tpl.id ? 'bold' : 'normal', pr: 8 }}
                                secondary={tpl.filename}
                                secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                              />
                          </ListItemButton>
                      </ListItem>
                  ))}
                  {templates.length === 0 && (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">暂无模板，请点击右上角添加。</Typography>
                      </Box>
                  )}
              </List>
          </Box>

          {/* Configuration Area */}
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress />
                  </Box>
              ) : !selectedTemplateId ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'text.secondary' }}>
                      <DescriptionIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
                      <Typography variant="h6">请从左侧选择一个模板</Typography>
                      <Typography variant="body2">或上传一个新的 Word 模板开始配置</Typography>
                  </Box>
              ) : (
                  <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
                      {/* Fields Sidebar */}
                      <Box sx={{ width: 280, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
                        <Tabs 
                            value={activeTab} 
                            onChange={(_, v) => { setActiveTab(v); setSelectedField(null); }}
                            variant="fullWidth"
                            sx={{ bgcolor: '#fff', borderBottom: '1px solid #e0e0e0' }}
                        >
                            <Tab label={<Badge badgeContent={singletonPlaceholders.length} color="primary" variant="dot">人员</Badge>} />
                            <Tab label={<Badge badgeContent={loopPlaceholders.length} color="secondary" variant="dot">项目</Badge>} />
                        </Tabs>
                        <List sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
                            {activeTab === 0 && singletonPlaceholders.map(p => renderSidebarItem(p, personMapping, personAI))}
                            {activeTab === 1 && loopPlaceholders.map(p => renderSidebarItem(p, projectMapping, projectAI))}
                        </List>
                      </Box>

                      {/* Config Panel */}
                      <Box sx={{ flexGrow: 1, bgcolor: '#fff', overflow: 'hidden' }}>
                          {renderDetailPanel()}
                      </Box>
                  </Box>
              )}
          </Box>

      </Paper>

      <Dialog open={actionDialogOpen} onClose={() => setActionDialogOpen(false)}>
        <DialogTitle>{actionType === 'copy' ? '复制模板' : '重命名模板'}</DialogTitle>
        <DialogContent>
            <TextField
                autoFocus
                margin="dense"
                label="模板名称"
                fullWidth
                variant="standard"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setActionDialogOpen(false)}>取消</Button>
            <Button onClick={handleActionSubmit}>{actionType === 'copy' ? '复制' : '保存'}</Button>
        </DialogActions>
      </Dialog>

      {snackbar && (
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
};

export default FieldMapper;