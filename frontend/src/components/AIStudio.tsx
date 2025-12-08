import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Grid,
    CircularProgress,
    Card,
    CardContent,
    CardActions,
    Alert,
    Snackbar,
    Divider,
    Chip
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface TableRow {
    [key: string]: any;
}

interface APIConfig {
    id: number;
    provider: string;
    model_name: string;
}

const AIStudio: React.FC = () => {
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [records, setRecords] = useState<TableRow[]>([]);
    const [selectedRecordId, setSelectedRecordId] = useState<string>('');
    const [selectedRecord, setSelectedRecord] = useState<TableRow | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>('');
    const [targetFields, setTargetFields] = useState<string>(''); // Comma separated
    const [generatedData, setGeneratedData] = useState<TableRow | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' });
    
    // Config State
    const [configs, setConfigs] = useState<APIConfig[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState<number | ''>('');

    // 1. Fetch Tables & Configs
    useEffect(() => {
        // Fetch Tables
        fetch(`${API_URL}/data/tables`)
            .then(res => res.json())
            .then(data => setTables(data.tables || []))
            .catch(err => console.error("Error fetching tables:", err));
        
        // Fetch Configs
        fetch(`${API_URL}/configs`)
            .then(res => res.json())
            .then(data => {
                setConfigs(data);
                // Auto-select first active config if available
                if (data.length > 0) {
                    setSelectedConfigId(data[0].id);
                }
            })
            .catch(err => console.error("Error fetching configs:", err));
    }, []);

    // 2. Fetch Records when table changes
    useEffect(() => {
        if (!selectedTable) return;
        setLoading(true);
        fetch(`${API_URL}/data/tables/${selectedTable}`)
            .then(res => res.json())
            .then(data => {
                setRecords(data.data || []);
                setLoading(false);
                setSelectedRecordId('');
                setSelectedRecord(null);
            })
            .catch(err => {
                console.error("Error fetching records:", err);
                setLoading(false);
            });
    }, [selectedTable]);

    // 3. Set Selected Record
    useEffect(() => {
        if (!selectedRecordId || !records) {
            setSelectedRecord(null);
            return;
        }
        const rec = records.find(r => String(r.id) === String(selectedRecordId));
        setSelectedRecord(rec || null);
    }, [selectedRecordId, records]);

    const handleGenerate = async () => {
        if (!selectedTable || !selectedRecordId) return;
        
        setLoading(true);
        setGeneratedData(null);
        
        try {
            // Determine target fields: explicit user input OR find empty fields
            let fieldsToRequest = targetFields.split(',').map(s => s.trim()).filter(Boolean);
            
            if (fieldsToRequest.length === 0 && selectedRecord) {
                 // Auto-detect empty fields
                 fieldsToRequest = Object.keys(selectedRecord).filter(k => 
                    selectedRecord[k] === null || selectedRecord[k] === ""
                 );
            }

            if (fieldsToRequest.length === 0) {
                 setSnackbar({ open: true, message: '没有检测到空字段，请手动输入需要生成的字段名。', severity: 'warning' });
                 setLoading(false);
                 return;
            }

            const response = await fetch(`${API_URL}/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table_name: selectedTable,
                    record_id: selectedRecordId,
                    target_fields: fieldsToRequest,
                    user_prompt: userPrompt,
                    config_id: selectedConfigId || undefined
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'AI Generation failed');
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            setGeneratedData(data);
            setSnackbar({ open: true, message: 'AI 生成成功！', severity: 'success' });
        } catch (error: any) {
            console.error(error);
            setSnackbar({ open: true, message: `生成失败: ${error.message}`, severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!selectedTable || !generatedData || !selectedRecord) return;
        
        // Merge generated data into selected record
        const updatedRow = { ...selectedRecord, ...generatedData };
        
        try {
            const response = await fetch(`${API_URL}/data/tables/${selectedTable}/row`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: updatedRow })
            });
            
            if (!response.ok) throw new Error('Update failed');
            
            setSnackbar({ open: true, message: '数据已更新！', severity: 'success' });
            
            // Refresh local state
            setRecords(prev => prev.map(r => String(r.id) === String(selectedRecordId) ? updatedRow : r));
            setSelectedRecord(updatedRow);
            setGeneratedData(null);
        } catch (error) {
            setSnackbar({ open: true, message: '更新失败', severity: 'error' });
        }
    };

    return (
        <Box sx={{ flexGrow: 1, p: 2 }}>
            <Grid container spacing={3}>
                {/* 1. Context Selection */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h6" gutterBottom color="primary">1. 选择数据源</Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            选择需要补全的记录。AI 将读取该记录的现有信息作为上下文。
                        </Typography>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>数据表</InputLabel>
                            <Select
                                value={selectedTable}
                                label="数据表"
                                onChange={(e: SelectChangeEvent) => setSelectedTable(e.target.value)}
                            >
                                {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                            </Select>
                        </FormControl>
                        
                        <FormControl fullWidth margin="normal" disabled={!selectedTable}>
                            <InputLabel>目标记录 (ID/Name)</InputLabel>
                            <Select
                                value={selectedRecordId}
                                label="目标记录"
                                onChange={(e: SelectChangeEvent) => setSelectedRecordId(e.target.value)}
                            >
                                {records.map(r => (
                                    <MenuItem key={r.id} value={r.id}>
                                        {r.name || r.full_name || r.id}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {selectedRecord && (
                            <Box sx={{ mt: 2, flexGrow: 1, overflow: 'auto', bgcolor: '#f5f5f5', p: 1, borderRadius: 1, maxHeight: '400px' }}>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                    <pre>{JSON.stringify(selectedRecord, null, 2)}</pre>
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* 2. Prompt Engineering */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">2. 配置生成指令</Typography>
                        
                        {/* Model Selection */}
                        <FormControl fullWidth margin="normal" size="small">
                            <InputLabel id="model-select-label">AI 模型 (Model)</InputLabel>
                            <Select
                                labelId="model-select-label"
                                value={selectedConfigId}
                                label="AI 模型 (Model)"
                                onChange={(e) => setSelectedConfigId(Number(e.target.value))}
                            >
                                {configs.map(config => (
                                    <MenuItem key={config.id} value={config.id}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <SettingsSuggestIcon fontSize="small" color="action" />
                                            <Typography variant="body2">{config.provider.toUpperCase()}</Typography>
                                            <Chip label={config.model_name} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                        </Box>
                                    </MenuItem>
                                ))}
                                {configs.length === 0 && <MenuItem disabled>请先在“系统设置”中添加模型</MenuItem>}
                            </Select>
                        </FormControl>

                        <Divider sx={{ my: 2 }} />

                        <TextField
                            fullWidth
                            label="目标字段 (留空则自动补全所有空值)"
                            variant="outlined"
                            margin="normal"
                            value={targetFields}
                            onChange={(e) => setTargetFields(e.target.value)}
                            placeholder="例如: summary, skills (逗号分隔)"
                            helperText="AI 将只生成这些字段的内容"
                        />
                        <TextField
                            fullWidth
                            label="补充指令 (Prompt)"
                            multiline
                            rows={8}
                            variant="outlined"
                            margin="normal"
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            placeholder="例如：请根据该候选人的过往经历，生成一段专业的个人简介，重点突出他在后端架构方面的优势..."
                            helperText="越具体的指令，生成效果越好"
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            size="large"
                            startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <AutoFixHighIcon />}
                            onClick={handleGenerate}
                            disabled={loading || !selectedRecordId}
                            sx={{ mt: 3 }}
                        >
                            {loading ? 'AI 思考中...' : '开始智能补全'}
                        </Button>
                    </Paper>
                </Grid>

                {/* 3. Review & Apply */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">3. 结果预览与采纳</Typography>
                        {generatedData ? (
                            <Card variant="outlined" sx={{ bgcolor: '#e3f2fd', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>AI 建议内容:</Typography>
                                    <Box sx={{ bgcolor: 'white', p: 1, borderRadius: 1 }}>
                                        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: '0.875rem' }}>
                                            {JSON.stringify(generatedData, null, 2)}
                                        </pre>
                                    </Box>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                                    <Button size="small" color="error" onClick={() => setGeneratedData(null)}>
                                        丢弃
                                    </Button>
                                    <Button 
                                        startIcon={<SaveIcon />} 
                                        variant="contained" 
                                        color="success"
                                        onClick={handleApply}
                                    >
                                        写入数据库
                                    </Button>
                                </CardActions>
                            </Card>
                        ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'text.secondary', border: '2px dashed #e0e0e0', borderRadius: 2 }}>
                                <Typography>等待生成结果...</Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity as any}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AIStudio;
