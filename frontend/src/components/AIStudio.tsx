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
    Chip,
    Alert,
    Snackbar
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface TableRow {
    [key: string]: any;
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
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    // 1. Fetch Tables
    useEffect(() => {
        fetch(`${API_URL}/data/tables`)
            .then(res => res.json())
            .then(data => setTables(data.tables || []))
            .catch(err => console.error("Error fetching tables:", err));
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
        // Assuming 'id' is standard, but we should probably use the pk from metadata
        // For now, simple find
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
                 setSnackbar({ open: true, message: '没有检测到空字段，请手动输入需要生成的字段名。', severity: 'error' });
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
                    user_prompt: userPrompt
                })
            });

            if (!response.ok) throw new Error('AI Generation failed');

            const data = await response.json();
            setGeneratedData(data);
            setSnackbar({ open: true, message: 'AI 生成成功！', severity: 'success' });
        } catch (error) {
            console.error(error);
            setSnackbar({ open: true, message: '生成失败，请检查控制台。', severity: 'error' });
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
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>1. 选择上下文</Typography>
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
                            <Box sx={{ mt: 2, maxHeight: '300px', overflow: 'auto', bgcolor: '#f5f5f5', p: 1, borderRadius: 1 }}>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                    <pre>{JSON.stringify(selectedRecord, null, 2)}</pre>
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* 2. Prompt Engineering */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>2. AI 指令</Typography>
                        <TextField
                            fullWidth
                            label="目标字段 (逗号分隔，留空则自动补全空缺)"
                            variant="outlined"
                            margin="normal"
                            value={targetFields}
                            onChange={(e) => setTargetFields(e.target.value)}
                            placeholder="例如: summary, skills"
                        />
                        <TextField
                            fullWidth
                            label="提示词 (Prompt)"
                            multiline
                            rows={6}
                            variant="outlined"
                            margin="normal"
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            placeholder="例如：请根据该候选人的过往经历，生成一段专业的个人简介，重点突出他在后端架构方面的优势..."
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <AutoFixHighIcon />}
                            onClick={handleGenerate}
                            disabled={loading || !selectedRecordId}
                            sx={{ mt: 2 }}
                        >
                            {loading ? '生成中...' : '开始生成'}
                        </Button>
                    </Paper>
                </Grid>

                {/* 3. Review & Apply */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>3. 结果预览与采纳</Typography>
                        {generatedData ? (
                            <Card variant="outlined" sx={{ bgcolor: '#e3f2fd' }}>
                                <CardContent>
                                    <Typography variant="subtitle2" color="text.secondary">AI 建议内容:</Typography>
                                    <Box sx={{ mt: 1, maxHeight: '300px', overflow: 'auto' }}>
                                        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                                            {JSON.stringify(generatedData, null, 2)}
                                        </pre>
                                    </Box>
                                </CardContent>
                                <CardActions>
                                    <Button 
                                        size="small" 
                                        startIcon={<SaveIcon />} 
                                        variant="contained" 
                                        color="success"
                                        onClick={handleApply}
                                    >
                                        采纳并保存
                                    </Button>
                                    <Button size="small" color="error" onClick={() => setGeneratedData(null)}>
                                        丢弃
                                    </Button>
                                </CardActions>
                            </Card>
                        ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'text.secondary' }}>
                                <Typography>等待生成...</Typography>
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
