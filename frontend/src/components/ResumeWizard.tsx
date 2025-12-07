import React, { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Container,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Snackbar,
  Alert,
  TextField,
  CircularProgress,
  Chip,
  Stack,
  Autocomplete
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// --- Types ---
interface PersonRow {
  id: string | number;
  [key: string]: any;
}

const steps = ['选择人员与模板', '选择项目经历', 'AI 智能补全', '生成文档'];

const ResumeWizard: React.FC = () => {
  // --- Global Data ---
  const [tables, setTables] = useState<string[]>([]);
  const [personRows, setPersonRows] = useState<PersonRow[]>([]);
  const [projectRows, setProjectRows] = useState<PersonRow[]>([]);

  // --- Wizard State ---
  const [activeStep, setActiveStep] = useState(0);
  
  // Initialize from localStorage if available
  const [personTable, setPersonTable] = useState(localStorage.getItem('last_person_table') || '');
  const [personId, setPersonId] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  
  const [projectTable, setProjectTable] = useState(localStorage.getItem('last_project_table') || '');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  
  const [context, setContext] = useState<Record<string, any>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  // Use a separate state for detailed missing info (for display)
  const [detailedMissing, setDetailedMissing] = useState<string[]>([]);

  const [aiPrompt, setAiPrompt] = useState('');
  const [fieldInstructions, setFieldInstructions] = useState<Record<string, any>>({});
  const [modelName, setModelName] = useState('deepseek-chat');
  
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  // --- Initial Load ---
  useEffect(() => {
    fetch(`${API_BASE_URL}/data/tables`)
      .then(res => res.json())
      .then(data => setTables(data.tables || []))
      .catch(() => showMsg('无法加载数据表列表', 'error'));
  }, []);

  // --- Load Rows when Table Changes & Persist ---
  useEffect(() => {
    if (personTable) {
        localStorage.setItem('last_person_table', personTable);
        fetch(`${API_BASE_URL}/data/tables/${personTable}`)
            .then(res => res.json())
            .then(data => setPersonRows(data.data || []));
    } else {
        setPersonRows([]);
    }
  }, [personTable]);

  useEffect(() => {
    if (projectTable) {
        localStorage.setItem('last_project_table', projectTable);
        fetch(`${API_BASE_URL}/data/tables/${projectTable}`)
            .then(res => res.json())
            .then(data => setProjectRows(data.data || []));
    } else {
        setProjectRows([]);
    }
  }, [projectTable]);

  // --- Helpers ---
  const showMsg = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const getIdentity = (row: any) => {
    if (!row) return '';
    // Priority for Employee ID
    if (row.工号) return String(row.工号);
    if (row.employee_id) return String(row.employee_id);
    if (row.emp_id) return String(row.emp_id);
    if (row.id) return String(row.id);
    return 'Unknown ID';
  }

  const getDisplayName = (row: any) => {
    if (!row) return '';
    let name = '';
    if (row.姓名) name = row.姓名;
    else if (row.name) name = row.name;
    else if (row.full_name) name = row.full_name;
    else {
        const firstStr = Object.values(row).find(v => typeof v === 'string');
        name = firstStr ? String(firstStr) : '';
    }
    return name;
  };

  // --- Logic: Step Transitions ---

  const handleNext = async () => {
    if (activeStep === 0) {
      if (!personTable || !personId || !templateFile) {
        showMsg('请完成所有必选项', 'error');
        return;
      }
    } else if (activeStep === 1) {
      // Transitioning from Projects -> AI Analysis
      await performContextAnalysis();
    } else if (activeStep === 2) {
      // Transitioning from AI -> Generate
      // Context is already updated in state
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

    const handleReset = () => {

      setActiveStep(0);

      setContext({});

      setMissingFields([]);

      setDetailedMissing([]);

      setPersonId('');

      setTemplateFile(null); // Reset template file upon starting a new resume

      setProjectIds([]);

    };

  

    // --- Core Logic: Context Assembly & Analysis ---

    const performContextAnalysis = async () => {

      setLoading(true);

      try {

        // 1. Assemble Context (Get Data)

        const assembleRes = await fetch(`${API_BASE_URL}/context/assemble`, {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({

            person_table: personTable,

            person_id: personId,

            project_table: projectTable || null,

            project_ids: projectIds

          })

        });

        if (!assembleRes.ok) throw new Error('数据组装失败');

        const assembledContext = await assembleRes.json();

        // 1.5 Fetch Field Instructions (New)
        let mergedInstructions = {};
        if (personTable) {
            try {
                const pRes = await fetch(`${API_BASE_URL}/mappings/${personTable}`);
                const pData = await pRes.json();
                if (pData.ai_instructions) mergedInstructions = { ...mergedInstructions, ...pData.ai_instructions };
            } catch(e) { console.error(e); }
        }
        if (projectTable) {
            try {
                const projRes = await fetch(`${API_BASE_URL}/mappings/${projectTable}`);
                const projData = await projRes.json();
                if (projData.ai_instructions) mergedInstructions = { ...mergedInstructions, ...projData.ai_instructions };
            } catch(e) { console.error(e); }
        }
        setFieldInstructions(mergedInstructions);

        // 2. Parse Template (Get Placeholders)

        if (!templateFile) throw new Error('模板文件丢失');

        const formData = new FormData();

        formData.append('file', templateFile);

        

        const parseRes = await fetch(`${API_BASE_URL}/templates/parse`, {

          method: 'POST',

          body: formData

        });

        if (!parseRes.ok) throw new Error('模板解析失败');

        const parseData = await parseRes.json();

        const singletons: string[] = parseData.singleton_placeholders || [];

        const loops: string[] = parseData.loop_placeholders || [];

  

        // 3. Compare & Find Missing

        const missing: string[] = [];

        const missingDetails: string[] = []; // Human readable list

        

        // 3.1 Check Singletons

        singletons.forEach(key => {

          if (!assembledContext[key] || assembledContext[key].toString().trim() === '') {

            missing.push(key);

            missingDetails.push(key);

          }

        });

  

        // 3.2 Check Loop Fields (Projects)

        if (assembledContext.projects && Array.isArray(assembledContext.projects)) {

            const projectMissingCounts: Record<string, number> = {};

            let anyProjectMissing = false;

  

            assembledContext.projects.forEach((proj: any) => {

                loops.forEach(loopKey => {

                    // loopKey is like "p.project_name", context key is "project_name"

                    const key = loopKey.replace(/^p\./, '');

                    if (!proj[key] || proj[key].toString().trim() === '') {

                        anyProjectMissing = true;

                        projectMissingCounts[key] = (projectMissingCounts[key] || 0) + 1;

                    }

                });

            });

  

            if (anyProjectMissing) {

                missing.push('projects'); // Still instruct AI to fix 'projects' as a whole

                Object.entries(projectMissingCounts).forEach(([field, count]) => {

                    missingDetails.push(`项目经历: ${field} (${count}处缺失)`);

                });

            }

        }

  

        setContext(assembledContext);

        setMissingFields(missing); // For Logic (passed to AI)

        setDetailedMissing(missingDetails); // For UI

        

        // Set default prompt based on missing fields

        if (missing.length > 0) {

            setAiPrompt(`请根据候选人的背景信息，补全以下缺失内容：${missingDetails.join(', ')}。对于项目经历，请根据项目名称和候选人技能推断合理的描述。`);

        } else {

            setAiPrompt('当前没有检测到缺失字段，但你可以让我优化现有内容。');

        }

        

      } catch (e: any) {

        showMsg(e.message, 'error');

      } finally {

        setLoading(false);

      }

    };

  

    // --- Core Logic: AI Fill ---

    const handleAiFill = async () => {

      setLoading(true);

      try {

        const targets = missingFields.length > 0 ? missingFields : ['summary'];

  

        const res = await fetch(`${API_BASE_URL}/ai/fill_context`, {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({

            context: context,

            target_fields: targets,

            user_prompt: aiPrompt,

            field_instructions: fieldInstructions,

            model_name: modelName

          })

        });

        

        if (!res.ok) throw new Error('AI 补全请求失败');

        const aiData = await res.json();

        

        // Merge AI data into Context

        setContext(prev => ({

          ...prev,

          ...aiData

        }));

        

        // Update missing fields (remove filled ones)

        // Logic: if 'projects' was returned, assume project issues are fixed

        const filledKeys = Object.keys(aiData);

        

        const newMissing = missingFields.filter(k => !filledKeys.includes(k));

        setMissingFields(newMissing);

        

        if (filledKeys.includes('projects')) {

             setDetailedMissing(prev => prev.filter(s => !s.startsWith('项目经历')));

        }

        setDetailedMissing(prev => prev.filter(s => !filledKeys.includes(s)));

  

        showMsg('AI 补全完成！请检查结果', 'success');

      } catch (e: any) {

        showMsg(e.message, 'error');

      } finally {

        setLoading(false);

      }

    };

  

    // --- Core Logic: Generate Download ---

    const handleDownload = async () => {

      if (!templateFile) return;

      setLoading(true);

      try {

        const formData = new FormData();

        formData.append('file', templateFile);

        formData.append('context_str', JSON.stringify(context));

  

        const res = await fetch(`${API_BASE_URL}/generate/render_from_context`, {

          method: 'POST',

          body: formData

        });

  

        if (!res.ok) throw new Error('生成文档失败');

  

        const blob = await res.blob();

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;

        

        // 获取当前候选人信息并格式化文件名

        const selectedPerson = personRows.find(p => String(p.id) === String(personId));

        const personName = selectedPerson ? getDisplayName(selectedPerson) : '未知姓名';

        const personIdentity = selectedPerson ? getIdentity(selectedPerson) : '未知工号';

  

        a.download = `简历-${personName}-${personIdentity}.docx`;

        

        document.body.appendChild(a);

        a.click();

        a.remove();

        

        showMsg('下载已开始', 'success');

      } catch (e: any) {

        showMsg(e.message, 'error');

      } finally {

        setLoading(false);

      }

    };

  // --- Render Steps ---

  const renderStep0 = () => (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>选择候选人</Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>人员数据表</InputLabel>
            <Select value={personTable} label="人员数据表" onChange={(e) => setPersonTable(e.target.value)}>
              {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          
          <Autocomplete
            disabled={!personTable}
            options={personRows}
            getOptionLabel={(option) => {
                 const name = getDisplayName(option);
                 const id = getIdentity(option);
                 return `${name} (${id})`;
            }}
            filterOptions={(options, state) => {
                const inputValue = state.inputValue.toLowerCase();
                return options.filter(option => {
                    const name = getDisplayName(option).toLowerCase();
                    const id = getIdentity(option).toLowerCase();
                    return name.includes(inputValue) || id.includes(inputValue);
                });
            }}
            value={personRows.find(p => String(p.id) === String(personId)) || null}
            onChange={(_, newValue) => {
                setPersonId(newValue ? String(newValue.id) : '');
            }}
            renderInput={(params) => (
                <TextField {...params} label="搜索候选人 (姓名/工号)" fullWidth />
            )}
            renderOption={(props, option) => (
                <li {...props} key={option.id}>
                    <Box>
                        <Typography variant="body1">{getDisplayName(option)}</Typography>
                        <Typography variant="caption" color="text.secondary">工号: {getIdentity(option)}</Typography>
                    </Box>
                </li>
            )}
           />

        </Paper>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h6" gutterBottom>上传模板</Typography>
          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadIcon />}
            fullWidth
            sx={{ py: 2 }}
          >
            {templateFile ? templateFile.name : '选择 .docx 模板'}
            <input type="file" hidden accept=".docx" onChange={(e) => e.target.files && setTemplateFile(e.target.files[0])} />
          </Button>
          <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
            确保模板包含正确的 Jinja2 占位符 (例如 {"{{ summary }}"})
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );

  const renderStep1 = () => (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>选择项目经历 (可选)</Typography>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          如果不选，将不会填充项目列表。
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>项目数据表</InputLabel>
              <Select 
                value={projectTable} 
                label="项目数据表" 
                onChange={(e) => {
                  setProjectTable(e.target.value);
                  setProjectIds([]);
                }}
              >
                <MenuItem value=""><em>不关联项目</em></MenuItem>
                {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <FormControl fullWidth disabled={!projectTable}>
              <InputLabel>选择项目 (多选)</InputLabel>
              <Select
                multiple
                value={projectIds}
                label="选择项目 (多选)"
                onChange={(e) => {
                  const val = e.target.value;
                  setProjectIds(typeof val === 'string' ? val.split(',') : val);
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((id) => {
                      const proj = projectRows.find(r => String(r.id) === String(id));
                      return <Chip key={id} label={proj ? getDisplayName(proj) : id} size="small" />;
                    })}
                  </Box>
                )}
              >
                {projectRows.map(row => (
                  <MenuItem key={row.id} value={String(row.id)}>{getDisplayName(row)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );

  const renderStep2 = () => (
    <Grid container spacing={3}>
      {/* Context Viewer / Editor */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>数据上下文预览</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            以下是即将用于渲染的完整数据。您可以手动修改，或使用右侧 AI 进行补全。
          </Typography>
          
          <Stack spacing={2}>
             {Object.entries(context).map(([key, value]) => {
                if (key === 'projects') return null; // Skip complex objects for simple editor
                const isMissing = missingFields.includes(key);
                return (
                  <TextField
                    key={key}
                    label={key}
                    value={value || ''}
                    onChange={(e) => setContext(prev => ({ ...prev, [key]: e.target.value }))}
                    fullWidth
                    multiline={String(value).length > 50}
                    rows={String(value).length > 50 ? 3 : 1}
                    error={isMissing}
                    helperText={isMissing ? '该字段在模板中存在，但当前为空' : ''}
                    variant={isMissing ? "filled" : "outlined"}
                  />
                );
             })}
             
             {/* Simple visual indicator for projects */}
             {context.projects && (
                 <Box sx={{ mt: 2, p: 2, border: '1px dashed grey', borderRadius: 1 }}>
                     <Typography variant="subtitle2">
                         包含 {context.projects.length} 个项目经历 
                         {missingFields.includes('projects') && <Chip label="存在缺失字段" color="warning" size="small" sx={{ ml: 1 }} />}
                     </Typography>
                     <Typography variant="caption" color="text.secondary">
                         项目详细信息请使用 AI 补全或在原数据表中修改。
                     </Typography>
                 </Box>
             )}
          </Stack>
        </Paper>
      </Grid>
      
      {/* AI Controls */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
             <AutoFixHighIcon color="primary" />
             <Typography variant="h6">AI 补全实验室</Typography>
          </Stack>
          
          {detailedMissing.length > 0 ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">检测到缺失:</Typography>
              <ul style={{ paddingLeft: 20, margin: '4px 0', fontSize: '0.875rem' }}>
                {detailedMissing.map(f => <li key={f}>{f}</li>)}
              </ul>
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mb: 2 }}>
              所有字段看似已填。
            </Alert>
          )}

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
             <LightbulbIcon fontSize="small" color="action" />
             补全指令
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
             告诉 AI 如何处理这些空缺（例如：强调领导力、技术栈偏向 Python 等）。
          </Typography>
          
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>选择 AI 模型</InputLabel>
            <Select
                value={modelName}
                label="选择 AI 模型"
                onChange={(e) => setModelName(e.target.value)}
            >
                <MenuItem value="deepseek-chat">DeepSeek Chat (通用)</MenuItem>
                <MenuItem value="deepseek-coder">DeepSeek Coder (代码/技术)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="输入 Prompt 指令..."
            multiline
            rows={6}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            placeholder="例如：请根据项目经验，为 summary 字段写一段 100 字的总结，强调我的全栈开发能力..."
          />

          <Button 
            variant="contained" 
            fullWidth 
            onClick={handleAiFill}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AutoFixHighIcon />}
            sx={{ py: 1.5 }}
          >
            {loading ? 'AI 思考中...' : '执行补全'}
          </Button>
        </Paper>
      </Grid>
    </Grid>
  );

  const renderStep3 = () => (
    <Box sx={{ textAlign: 'center', py: 5 }}>
      <CheckCircleIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
      <Typography variant="h5" gutterBottom>准备就绪</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        您的数据上下文已组装完毕，点击下方按钮即可生成并下载 Word 文档。
      </Typography>
      
      <Button
        variant="contained"
        size="large"
        startIcon={<DownloadIcon />}
        onClick={handleDownload}
        disabled={loading}
      >
        {loading ? '生成中...' : '下载简历 (.docx)'}
      </Button>

      <Button onClick={handleReset} sx={{ mt: 4, display: 'block', mx: 'auto' }}>
        开始新的简历
      </Button>
    </Box>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ mb: 4 }}>
        {activeStep === 0 && renderStep0()}
        {activeStep === 1 && renderStep1()}
        {activeStep === 2 && renderStep2()}
        {activeStep === 3 && renderStep3()}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
        <Button
          color="inherit"
          disabled={activeStep === 0 || activeStep === 3}
          onClick={handleBack}
          startIcon={<ArrowBackIcon />}
        >
          上一步
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        {activeStep < 3 && (
            <Button onClick={handleNext} endIcon={<ArrowForwardIcon />} variant="contained">
              {activeStep === 2 ? '去生成' : '下一步'}
            </Button>
        )}
      </Box>

      {snackbar && (
        <Snackbar 
          open={snackbar.open} 
          autoHideDuration={4000} 
          onClose={() => setSnackbar(null)} 
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
};

export default ResumeWizard;