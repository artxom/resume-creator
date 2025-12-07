import React, { useState, ChangeEvent } from 'react';
import { Box, Button, Card, CardContent, Typography, TextField, CircularProgress, Alert } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';

export default function DataImporter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setTableName(file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase());
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !tableName.trim()) {
      setFeedback({type: 'error', message: '请选择文件并指定表名。'});
      return;
    }

    setLoading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('table_name', tableName.trim());

    try {
      const response = await fetch('http://localhost:8000/api/v1/data/upload/excel', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || '上传失败，请检查后端服务。');
      }

      setFeedback({type: 'success', message: `成功！${result.rows_imported} 行数据已导入到表 '${result.table_name}'。`});
      setSelectedFile(null);
      setTableName('');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '一个未知的错误发生了。';
      setFeedback({type: 'error', message: `错误: ${errorMessage}`});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 600, margin: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" component="div" gutterBottom>
          上传 Excel 数据文件
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          请选择一个 .xlsx 或 .xls 文件。系统会将其内容导入到数据库的一个新表中。
        </Typography>
        
        {feedback && (
          <Alert severity={feedback.type} sx={{ mb: 2 }}>
            {feedback.message}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button
            variant="contained"
            component="label"
            startIcon={<UploadFileIcon />}
            disabled={loading}
          >
            选择文件
            <input
              type="file"
              hidden
              accept=".xlsx, .xls"
              onChange={handleFileChange}
            />
          </Button>
          <Typography variant="body1" sx={{ color: selectedFile ? 'text.primary' : 'text.disabled' }}>
            {selectedFile ? `已选择: ${selectedFile.name}` : '未选择文件'}
          </Typography>
        </Box>

        <TextField
          fullWidth
          label="数据库表名"
          variant="outlined"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          sx={{ mb: 3 }}
          helperText="请输入一个有效的数据库表名（建议使用英文、数字和下划线）。"
          disabled={loading}
        />

        <Box sx={{ position: 'relative' }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            onClick={handleUpload}
            disabled={!selectedFile || !tableName.trim() || loading}
          >
            开始导入
          </Button>
          {loading && (
            <CircularProgress
              size={24}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-12px',
                marginLeft: '-12px',
              }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
