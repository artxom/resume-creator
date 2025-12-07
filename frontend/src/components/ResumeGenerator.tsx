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
  Grid,
  Snackbar,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const ResumeGenerator: React.FC = () => {
  // --- Global Data ---
  const [tables, setTables] = useState<string[]>([]);
  
  // --- Person Selection State ---
  const [personTable, setPersonTable] = useState<string>('');
  const [personId, setPersonId] = useState<string | number>('');
  const [personRows, setPersonRows] = useState<any[]>([]);

  // --- Project Selection State ---
  const [projectTable, setProjectTable] = useState<string>('');
  const [projectIds, setProjectIds] = useState<Array<string | number>>([]);
  const [projectRows, setProjectRows] = useState<any[]>([]);
  
  // --- File State ---
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  
  // --- UI State ---
  const [generating, setGenerating] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  // 1. Initial Load: Get Table List
  useEffect(() => {
    fetch(`${API_BASE_URL}/data/tables`)
      .then(res => res.json())
      .then(data => setTables(data.tables || []))
      .catch(() => setSnackbar({ open: true, message: '无法加载数据表列表', severity: 'error' }));
  }, []);

  // 2. Person Table Change: Load People
  useEffect(() => {
    if (!personTable) {
        setPersonRows([]);
        setPersonId(''); // Reset selection
        return;
    }
    fetch(`${API_BASE_URL}/data/tables/${personTable}`)
        .then(res => res.json())
        .then(data => setPersonRows(data.data || []))
        .catch(() => setSnackbar({ open: true, message: '无法加载人员数据', severity: 'error' }));
  }, [personTable]);

  // 3. Project Table Change: Load Projects
  useEffect(() => {
    if (!projectTable) {
        setProjectRows([]);
        setProjectIds([]); // Reset selection
        return;
    }
    fetch(`${API_BASE_URL}/data/tables/${projectTable}`)
        .then(res => res.json())
        .then(data => setProjectRows(data.data || []))
        .catch(() => setSnackbar({ open: true, message: '无法加载项目数据', severity: 'error' }));
  }, [projectTable]);

  // 4. Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setTemplateFile(e.target.files[0]);
      }
  };

  const handleGenerate = async () => {
      if (!personTable || !personId || !templateFile) {
          setSnackbar({ open: true, message: '请填写所有必选项并上传模板', severity: 'error' });
          return;
      }

      setGenerating(true);
      const formData = new FormData();
      formData.append('file', templateFile);
      formData.append('person_table', personTable);
      formData.append('person_id', String(personId));
      if (projectTable) {
          formData.append('project_table', projectTable);
      }
      if (projectIds.length > 0) {
          projectIds.forEach(id => formData.append('project_ids', String(id)));
      }

      try {
          const response = await fetch(`${API_BASE_URL}/generate/resume`, {
              method: 'POST',
              body: formData,
          });

          if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.detail || '生成失败');
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          
          const selectedPerson = personRows.find((p: any) => String(p.id) === String(personId));
          const name = selectedPerson ? getDisplayName(selectedPerson) : personId;
          a.download = `简历-${name}.docx`; 
          
          document.body.appendChild(a);
          a.click();
          a.remove();
          
          setSnackbar({ open: true, message: '简历已生成并开始下载', severity: 'success' });
      } catch (err: any) {
          setSnackbar({ open: true, message: err.message || '生成出错', severity: 'error' });
      } finally {
          setGenerating(false);
      }
  };

  // Helper: Person Display Name
  const getDisplayName = (row: any) => {
      if (row.姓名) return row.姓名;
      if (row.name) return row.name;
      if (row.full_name) return row.full_name;
      const firstStr = Object.values(row).find(v => typeof v === 'string');
      return firstStr ? String(firstStr) : row.id;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        简历生成
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
        选择人员，上传模板，一键生成 Word 简历。
      </Typography>

      <Grid container spacing={3}>
          {/* Left Column: Controls */}
          <Grid size={{ xs: 12, md: 6 }}> {/* Adjusted grid size */}
              {/* Person Selection */}
              <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>1. 选择人员</Typography>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>人员数据表</InputLabel>
                      <Select
                          value={personTable}
                          label="人员数据表"
                          onChange={(e) => setPersonTable(e.target.value)}
                      >
                          {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                      </Select>
                  </FormControl>
                  
                  <FormControl fullWidth disabled={!personTable}>
                      <InputLabel>选择候选人</InputLabel>
                      <Select
                          value={personId}
                          label="选择候选人"
                          onChange={(e) => setPersonId(e.target.value)}
                      >
                          {personRows.map((row: any) => (
                              <MenuItem key={row.id} value={row.id}>
                                  {getDisplayName(row)}
                              </MenuItem>
                          ))}
                      </Select>
                  </FormControl>
              </Paper>

              {/* Project Selection */}
              <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>2. 选择项目 (可选)</Typography>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>项目数据表</InputLabel>
                      <Select
                          value={projectTable}
                          label="项目数据表"
                          onChange={(e) => {
                            setProjectTable(e.target.value);
                            setProjectIds([]); // Reset selected projects when table changes
                          }}
                      >
                          <MenuItem value=""><em>无</em></MenuItem>
                          {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                      </Select>
                  </FormControl>
                  
                  <FormControl fullWidth disabled={!projectTable}>
                      <InputLabel>选择项目</InputLabel>
                      <Select
                          multiple
                          value={projectIds}
                          label="选择项目"
                          onChange={(e) => {
                            const value = e.target.value;
                            setProjectIds(typeof value === 'string' ? value.split(',') : value);
                          }}
                          renderValue={(selected) => (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {(selected as (string | number)[]).map((id) => {
                                      const project = projectRows.find(row => String(row.id) === String(id));
                                      return (
                                          <span key={id}>{project ? getDisplayName(project) : ''}</span>
                                      );
                                  })}
                              </Box>
                          )}
                      >
                          {projectRows.map((row: any) => (
                              <MenuItem key={row.id} value={row.id}>
                                  {getDisplayName(row)}
                              </MenuItem>
                          ))}
                      </Select>
                  </FormControl>
              </Paper>

              {/* Template Upload */}
              <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>3. 上传模板</Typography> {/* Renumbered step */}
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUploadIcon />}
                    fullWidth
                    sx={{ mb: 1 }}
                  >
                    {templateFile ? templateFile.name : '选择 .docx 文件'}
                    <input type="file" hidden accept=".docx" onChange={handleFileChange} />
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                      请上传配置过字段映射的 Word 模板。
                  </Typography>
              </Paper>
          </Grid>

          {/* Right Column: Generate Button */}
          <Grid size={{ xs: 12, md: 6 }}> {/* Adjusted grid size */}
              <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="h6" gutterBottom>3. 生成并下载</Typography> {/* Renumbered step */}
                  <Button
                      variant="contained"
                      size="large"
                      startIcon={<DownloadIcon />}
                      onClick={handleGenerate}
                      disabled={generating || !personId || !templateFile}
                      sx={{ mt: 2, mb: 2 }}
                  >
                      {generating ? '生成中...' : '生成并下载简历'}
                  </Button>
                   <Typography variant="body2" color="text.secondary">
                      确认人员选择和模板上传后即可生成。
                  </Typography>
              </Paper>
          </Grid>
      </Grid>

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

export default ResumeGenerator;
