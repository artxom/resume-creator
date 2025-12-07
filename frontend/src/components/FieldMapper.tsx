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
  IconButton,
  Tooltip,
  Grid
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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

  // AI Instructions
  const [personAI, setPersonAI] = useState<AIInstructionsMap>({});
  const [projectAI, setProjectAI] = useState<AIInstructionsMap>({});

  // UI States
  const [activeTab, setActiveTab] = useState(0); // 0: Person, 1: Project
  const [selectedField, setSelectedField] = useState<string | null>(null);
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

  // Load Saved Mapping
  const loadMapping = async (tableName: string, setMap: any, setAI: any) => {
      try {
          const res = await fetch(`${API_BASE_URL}/mappings/${tableName}`);
          const data = await res.json();
          if (data.mapping_data) setMap(data.mapping_data);
          if (data.ai_instructions) setAI(data.ai_instructions);
      } catch (err) {
          console.error("Failed to load mapping", err);
      }
  };

  useEffect(() => {
    if (personTable) {
        fetchColumns(personTable);
        loadMapping(personTable, setPersonMapping, setPersonAI);
    }
  }, [personTable]);

  useEffect(() => {
    if (projectTable) {
        fetchColumns(projectTable);
        loadMapping(projectTable, setProjectMapping, setProjectAI);
    }
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
      
      // Auto-select first field if available
      if (data.singleton_placeholders?.length > 0) {
          setSelectedField(data.singleton_placeholders[0]);
          setActiveTab(0);
      } else if (data.loop_placeholders?.length > 0) {
          setSelectedField(data.loop_placeholders[0]);
          setActiveTab(1);
      }

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
      if (personTable) {
          await fetch(`${API_BASE_URL}/mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table_name: personTable,
              mapping_data: personMapping,
              ai_instructions: personAI
            })
          });
      }

      if (projectTable && projectTable !== personTable) {
          await fetch(`${API_BASE_URL}/mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table_name: projectTable,
                mapping_data: projectMapping,
                ai_instructions: projectAI
            })
          });
      } else if (projectTable && projectTable === personTable) {
          const mergedMapping = { ...personMapping, ...projectMapping };
          const mergedAI = { ...personAI, ...projectAI };
          await fetch(`${API_BASE_URL}/mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table_name: personTable,
                mapping_data: mergedMapping,
                ai_instructions: mergedAI
            })
          });
      }

      setSnackbar({ open: true, message: '所有映射及AI配置已保存！', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: '保存映射失败', severity: 'error' });
    } finally {
      setSaving(false);
    }
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
        <ListItem 
            key={p} 
            button 
            selected={isSelected}
            onClick={() => setSelectedField(p)}
            sx={{ 
                borderRadius: 1, 
                mb: 0.5,
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
                              <Grid item xs={12}>
                                  <FormControl fullWidth size="small">
                                      <InputLabel>选择数据表 ({tableLabel})</InputLabel>
                                      <Select
                                          value={currentTable}
                                          label={`选择数据表 (${tableLabel})`}
                                          onChange={(e) => setTable(e.target.value as string)}
                                      >
                                          {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                      </Select>
                                  </FormControl>
                              </Grid>
                              <Grid item xs={12}>
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
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              如果没有对应的数据库列，可以留空，完全依赖下方的 AI 指令生成内容。
                          </Typography>
                      </CardContent>
                  </Card>

                  {/* Section 2: AI Config */}
                  <Card variant="outlined" sx={{ bgcolor: '#fafafa' }}>
                      <CardContent>
                          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AutoFixHighIcon color="primary" /> AI 智能生成配置 (Meta-Prompting)
                          </Typography>
                          <Divider sx={{ mb: 2 }} />
                          
                          <Grid container spacing={3}>
                              {/* Row 1: Small Inputs */}
                              <Grid item xs={12} md={4}>
                                  <TextField 
                                      fullWidth 
                                      size="small" 
                                      label="建议长度" 
                                      placeholder="例: 100字左右" 
                                      value={currentAI.length} 
                                      onChange={(e) => updateAIInstruction(selectedField, 'length', e.target.value, setAIConfig)}
                                  />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                  <TextField 
                                      fullWidth 
                                      size="small" 
                                      label="输出格式" 
                                      placeholder="例: 纯文本, JSON" 
                                      value={currentAI.format} 
                                      onChange={(e) => updateAIInstruction(selectedField, 'format', e.target.value, setAIConfig)}
                                  />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                  <TextField 
                                      fullWidth 
                                      size="small" 
                                      label="其他约束条件" 
                                      placeholder="例: STAR法则" 
                                      value={currentAI.other} 
                                      onChange={(e) => updateAIInstruction(selectedField, 'other', e.target.value, setAIConfig)}
                                  />
                              </Grid>

                              {/* Row 2: Large Description Input */}
                              <Grid item xs={12}>
                                  <TextField 
                                      fullWidth 
                                      multiline 
                                      rows={5} 
                                      label="核心描述与生成重点" 
                                      placeholder="告诉 AI 这个字段应该包含什么内容。例如：'总结我的后端开发经验，重点突出 Python 和 AWS 项目，语气要专业自信。'" 
                                      value={currentAI.description} 
                                      onChange={(e) => updateAIInstruction(selectedField, 'description', e.target.value, setAIConfig)}
                                      helperText="这是最重要的指令，决定了生成内容的质量。"
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
                配置每个字段的数据来源及 AI 生成规则，以获得最佳简历效果。
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
             <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
            >
                {templateParsed ? "重新上传模板" : "上传 Word 模板"}
                <input type="file" hidden accept=".docx" onChange={handleFileUpload} />
            </Button>
            {templateParsed && (
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? '保存中...' : '保存所有配置'}
                </Button>
            )}
          </Stack>
      </Box>

      {parsing && <Box sx={{ width: '100%', mb: 2 }}><CircularProgress size={20} /> 解析模板中...</Box>}

      {templateParsed ? (
          <Paper sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
              
              {/* Left Sidebar */}
              <Box sx={{ width: 320, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
                  <Tabs 
                    value={activeTab} 
                    onChange={(_, v) => { setActiveTab(v); setSelectedField(null); }}
                    variant="fullWidth"
                    sx={{ bgcolor: '#fff', borderBottom: '1px solid #e0e0e0' }}
                  >
                      <Tab label={<Badge badgeContent={singletonPlaceholders.length} color="primary">人员字段</Badge>} />
                      <Tab label={<Badge badgeContent={loopPlaceholders.length} color="secondary">项目字段</Badge>} />
                  </Tabs>
                  
                  <List sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
                      {activeTab === 0 && singletonPlaceholders.map(p => renderSidebarItem(p, personMapping, personAI))}
                      {activeTab === 1 && loopPlaceholders.map(p => renderSidebarItem(p, projectMapping, projectAI))}
                      
                      {(activeTab === 0 ? singletonPlaceholders : loopPlaceholders).length === 0 && (
                          <Typography variant="caption" sx={{ p: 2, display: 'block', textAlign: 'center', color: 'text.secondary' }}>
                              该类别下无字段
                          </Typography>
                      )}
                  </List>
              </Box>

              {/* Right Detail Panel */}
              <Box sx={{ flexGrow: 1, bgcolor: '#fff' }}>
                  {renderDetailPanel()}
              </Box>

          </Paper>
      ) : (
          <Paper sx={{ p: 5, textAlign: 'center', bgcolor: '#f5f5f5', border: '2px dashed #ccc' }}>
              <CloudUploadIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                  请先上传 Word 简历模板 (.docx) 以开始配置
              </Typography>
          </Paper>
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
