import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Snackbar,
    Alert,
    CircularProgress,
    Divider,
    Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveIcon from '@mui/icons-material/Save';
import ExtensionIcon from '@mui/icons-material/Extension';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface APIConfig {
    id: number;
    provider: string;
    api_key: string;
    base_url: string;
    model_name: string;
    is_active: number;
}

const PRESETS = {
    'deepseek': {
        base_url: 'https://api.deepseek.com',
        model_name: 'deepseek-chat'
    },
    'openrouter': {
        base_url: 'https://openrouter.ai/api/v1',
        model_name: 'deepseek/deepseek-chat'
    },
    'gemini': {
        base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/', 
        model_name: 'gemini-2.0-flash-exp'
    },
    'qwen': {
        base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model_name: 'qwen-turbo'
    }
};

const ConfigPage: React.FC = () => {
    const [configs, setConfigs] = useState<APIConfig[]>([]);
    const [formData, setFormData] = useState({
        provider: 'deepseek',
        api_key: '',
        base_url: PRESETS['deepseek'].base_url,
        model_name: PRESETS['deepseek'].model_name
    });
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            const res = await fetch(`${API_URL}/configs`);
            const data = await res.json();
            setConfigs(data);
        } catch (error) {
            console.error('Error fetching configs:', error);
        }
    };

    const handleProviderChange = (e: any) => {
        const provider = e.target.value as keyof typeof PRESETS;
        setFormData({
            ...formData,
            provider,
            base_url: PRESETS[provider]?.base_url || '',
            model_name: PRESETS[provider]?.model_name || ''
        });
    };

    const handleSave = async () => {
        if (!formData.api_key) {
            setSnackbar({ open: true, message: 'API Key 不能为空', severity: 'error' });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/configs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setSnackbar({ open: true, message: '配置保存成功', severity: 'success' });
                fetchConfigs();
                setFormData({ ...formData, api_key: '' }); // Clear key for security
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            setSnackbar({ open: true, message: '保存失败', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('确定要删除这个配置吗？')) return;
        try {
            await fetch(`${API_URL}/configs/${id}`, { method: 'DELETE' });
            fetchConfigs();
            setSnackbar({ open: true, message: '已删除', severity: 'info' });
        } catch (error) {
            console.error(error);
        }
    };

    const handleTest = async () => {
        if (!formData.api_key) {
             setSnackbar({ open: true, message: '请先填写 API Key', severity: 'error' });
             return;
        }
        setTesting(true);
        try {
            const res = await fetch(`${API_URL}/configs/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await res.json();
            if (res.ok) {
                setSnackbar({ open: true, message: `连接成功! 响应: ${JSON.stringify(result.response)}`, severity: 'success' });
            } else {
                throw new Error(result.detail || 'Test failed');
            }
        } catch (error: any) {
             setSnackbar({ open: true, message: `连接失败: ${error.message}`, severity: 'error' });
        } finally {
            setTesting(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Grid container spacing={4}>
                {/* Left: Form */}
                <Grid size={{ xs: 12, md: 5 }}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ExtensionIcon /> 添加/更新模型配置
                        </Typography>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>提供商 (Provider)</InputLabel>
                            <Select
                                value={formData.provider}
                                label="提供商 (Provider)"
                                onChange={handleProviderChange}
                            >
                                <MenuItem value="deepseek">DeepSeek</MenuItem>
                                <MenuItem value="openrouter">OpenRouter (推荐/美国节点)</MenuItem>
                                <MenuItem value="gemini">Google Gemini</MenuItem>
                                <MenuItem value="qwen">阿里通义千问 (Qwen)</MenuItem>
                                <MenuItem value="custom">Custom (OpenAI Compatible)</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            label="API Key"
                            type="password"
                            margin="normal"
                            value={formData.api_key}
                            onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                            helperText="您的 Key 仅存储在本地数据库中"
                        />

                        <TextField
                            fullWidth
                            label="Base URL"
                            margin="normal"
                            value={formData.base_url}
                            onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                            helperText="OpenAI 兼容接口地址"
                        />

                        <TextField
                            fullWidth
                            label="Model Name"
                            margin="normal"
                            value={formData.model_name}
                            onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                        />

                        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                            <Button
                                variant="contained"
                                startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <SaveIcon />}
                                onClick={handleSave}
                                disabled={loading || testing}
                            >
                                保存配置
                            </Button>
                            <Button
                                variant="outlined"
                                color="secondary"
                                startIcon={testing ? <CircularProgress size={20} color="inherit"/> : <CheckCircleIcon />}
                                onClick={handleTest}
                                disabled={loading || testing || !formData.api_key}
                            >
                                测试连接
                            </Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* Right: List */}
                <Grid size={{ xs: 12, md: 7 }}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            已保存的模型
                        </Typography>
                        <List>
                            {configs.length === 0 && (
                                <Typography color="text.secondary">暂无配置，请在左侧添加。</Typography>
                            )}
                            {configs.map((config) => (
                                <React.Fragment key={config.id}>
                                    <ListItem>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {config.provider.toUpperCase()}
                                                    </Typography>
                                                    <Chip size="small" label={config.model_name} color="primary" variant="outlined" />
                                                </Box>
                                            }
                                            secondary={
                                                <>
                                                    <Typography variant="body2" component="span" display="block">
                                                        URL: {config.base_url}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        ID: {config.id} | Status: {config.is_active ? 'Active' : 'Inactive'}
                                                    </Typography>
                                                </>
                                            }
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(config.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                    <Divider component="li" />
                                </React.Fragment>
                            ))}
                        </List>
                    </Paper>
                </Grid>
            </Grid>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ConfigPage;
