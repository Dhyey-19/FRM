import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, TextField, Button, Alert, 
  CircularProgress, Divider, Card, CardContent,
  RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import { 
  Business as BusinessIcon, Save as SaveIcon, Edit as EditIcon, Info as InfoIcon,
  QrCode2 as QrCodeIcon, ElectricBolt as BoltIcon, Security as SecurityIcon
} from '@mui/icons-material';

const CompanyProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [einvoiceSettings, setEinvoiceSettings] = useState({
    Environment: 'simulation',
    ClientId: '',
    ClientSecret: '',
    Username: '',
    Password: '',
    BaseUrl: 'https://einv-apisandbox.nic.in/eivital/v1.03'
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  const [formData, setFormData] = useState({
    CompanyName: '',
    Address1: '',
    Address2: '',
    City: '',
    StateName: '',
    CountryName: '',
    Pincode: '',
    ContactPerson: '',
    PhoneNo: '',
    MobileNo: '',
    EmailID: '',
    Website: '',
    GSTIN: '',
    PANNo: '',
    BankName: '',
    BranchName: '',
    AccountNo: '',
    IFSCCode: '',
    UPI: ''
  });

  const fetchProfile = async () => {
    try {
      const [profileRes, einvRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/settings`)
      ]);

      const data = await profileRes.json();
      if (profileRes.ok && data) {
        setFormData({
          CompanyName: data.CompanyName || '',
          Address1: data.Address1 || '',
          Address2: data.Address2 || '',
          City: data.City || '',
          StateName: data.StateName || '',
          CountryName: data.CountryName || '',
          Pincode: data.Pincode || '',
          ContactPerson: data.ContactPerson || '',
          PhoneNo: data.PhoneNo || '',
          MobileNo: data.MobileNo || '',
          EmailID: data.EmailID || '',
          Website: data.Website || '',
          GSTIN: data.GSTIN || '',
          PANNo: data.PANNo || '',
          BankName: data.BankName || '',
          BranchName: data.BranchName || '',
          AccountNo: data.AccountNo || '',
          IFSCCode: data.IFSCCode || '',
          UPI: data.UPI || ''
        });
        setProfileExists(true);
      } else {
        setProfileExists(false);
      }

      if (einvRes.ok) {
        const einvData = await einvRes.json();
        setEinvoiceSettings({
          Environment: einvData.Environment || 'simulation',
          ClientId: einvData.ClientId || '',
          ClientSecret: einvData.ClientSecret || '',
          Username: einvData.Username || '',
          Password: einvData.Password || '',
          BaseUrl: einvData.BaseUrl || 'https://einv-apisandbox.nic.in/eivital/v1.03'
        });
      }
    } catch (error) {
      console.error('Error fetching company profile:', error);
      setMessage({ type: 'error', text: 'Failed to load company profile.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...einvoiceSettings,
          Gstin: formData.GSTIN
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gateway connection failed');
      setConnectionStatus({
        type: 'success',
        text: data.message || 'Connection verified successfully!'
      });
    } catch (err) {
      setConnectionStatus({
        type: 'error',
        text: err.message || 'Connection failed. Please check credentials.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.CompanyName.trim()) {
      setMessage({ type: 'error', text: 'Company Name is required.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`;
      const method = profileExists ? 'PUT' : 'POST';

      const [profRes, einvRes] = await Promise.all([
        fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...einvoiceSettings,
            Gstin: formData.GSTIN
          })
        })
      ]);
      
      const data = await profRes.json();
      if (profRes.ok) {
        setMessage({ type: 'success', text: 'Company profile and e-Invoice settings saved successfully.' });
        setProfileExists(true);
        
        // Update local storage so the new company name reflects globally (e.g. in reports)
        const current = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
        current.companyName = formData.CompanyName;
        localStorage.setItem('user', JSON.stringify(current));
      } else {
        setMessage({ type: 'error', text: data.message || 'Error saving company profile.' });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'Action failed. Please check the backend connection.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1200px', margin: '0 auto', p: 1 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <BusinessIcon sx={{ fontSize: 32, color: '#0F3B66' }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66' }}>
          Company Profile Configuration
        </Typography>
      </Box>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3, borderRadius: 2 }}>
          {message.text}
        </Alert>
      )}

      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3, borderRadius: 2 }}>
        {profileExists 
          ? "A company profile is already configured. You can edit and save changes to this record." 
          : "No company profile found. Please fill in the details below to create the initial record (only one company record is permitted)."}
      </Alert>

      <form onSubmit={handleSave}>
        <Grid container spacing={3}>
          {/* General Information Section */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                  General Company Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      label="Company Name" 
                      name="CompanyName" 
                      value={formData.CompanyName} 
                      onChange={handleChange} 
                      required 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField 
                      fullWidth 
                      label="GSTIN" 
                      name="GSTIN" 
                      value={formData.GSTIN} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField 
                      fullWidth 
                      label="PAN No" 
                      name="PANNo" 
                      value={formData.PANNo} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Address Section */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                  Registered Office Address
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Address Line 1" 
                      name="Address1" 
                      value={formData.Address1} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Address Line 2" 
                      name="Address2" 
                      value={formData.Address2} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="City" 
                      name="City" 
                      value={formData.City} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="State" 
                      name="StateName" 
                      value={formData.StateName} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="Country" 
                      name="CountryName" 
                      value={formData.CountryName} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="Pincode" 
                      name="Pincode" 
                      value={formData.Pincode} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Contact Details Section */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                  Contact Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Contact Person" 
                      name="ContactPerson" 
                      value={formData.ContactPerson} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="Phone No" 
                      name="PhoneNo" 
                      value={formData.PhoneNo} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="Mobile No" 
                      name="MobileNo" 
                      value={formData.MobileNo} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Email ID" 
                      name="EmailID" 
                      type="email" 
                      value={formData.EmailID} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Website" 
                      name="Website" 
                      value={formData.Website} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Bank Details Section */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                  Bank Details & UPI
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField 
                      fullWidth 
                      label="Bank Name" 
                      name="BankName" 
                      value={formData.BankName} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField 
                      fullWidth 
                      label="Branch Name" 
                      name="BranchName" 
                      value={formData.BranchName} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField 
                      fullWidth 
                      label="Account No" 
                      name="AccountNo" 
                      value={formData.AccountNo} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      label="IFSC Code" 
                      name="IFSCCode" 
                      value={formData.IFSCCode} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      label="UPI ID" 
                      name="UPI" 
                      value={formData.UPI} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Government NIC e-Invoice & IRP Gateway Credentials Section */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.02)', borderColor: '#93c5fd' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#f0f7ff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <QrCodeIcon sx={{ fontSize: 26, color: '#0F3B66' }} />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        Government NIC e-Invoice & IRP API Credentials
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#475569' }}>
                        Saved once here for the entire company. Used automatically for all Sales records (no need to re-type on each invoice).
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    type="button"
                    variant="outlined"
                    color="primary"
                    size="small"
                    disabled={testingConnection}
                    startIcon={testingConnection ? <CircularProgress size={16} /> : <SecurityIcon />}
                    onClick={handleTestConnection}
                    sx={{ fontWeight: 600, textTransform: 'none', bgcolor: '#fff' }}
                  >
                    {testingConnection ? 'Testing Connection...' : 'Test NIC Connection'}
                  </Button>
                </Box>

                {connectionStatus && (
                  <Alert severity={connectionStatus.type} sx={{ mb: 2 }}>
                    {connectionStatus.text}
                  </Alert>
                )}

                <Paper variant="outlined" sx={{ p: 2, mb: 2.5, bgcolor: '#fff' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                    GATEWAY ENVIRONMENT:
                  </Typography>
                  <RadioGroup
                    row
                    value={einvoiceSettings.Environment}
                    onChange={(e) => {
                      const env = e.target.value;
                      let url = einvoiceSettings.BaseUrl;
                      if (env === 'sandbox') url = 'https://einv-apisandbox.nic.in/eivital/v1.03';
                      if (env === 'production') url = 'https://api.einvoice1.gst.gov.in/eivital/v1.03';
                      setEinvoiceSettings(prev => ({ ...prev, Environment: env, BaseUrl: url }));
                    }}
                  >
                    <FormControlLabel value="simulation" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Simulation Engine (Safe Demo Mode)</Typography>} />
                    <FormControlLabel value="sandbox" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>NIC Sandbox (Testing einv-apisandbox.nic.in)</Typography>} />
                    <FormControlLabel value="production" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Live Production (einvoice1.gst.gov.in)</Typography>} />
                  </RadioGroup>
                </Paper>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField 
                      fullWidth 
                      label="API Username" 
                      placeholder="e-Invoice portal username"
                      value={einvoiceSettings.Username} 
                      onChange={(e) => setEinvoiceSettings({ ...einvoiceSettings, Username: e.target.value })} 
                      size="small" 
                      helperText="Username from einvoice1.gst.gov.in API Registration"
                      sx={{ bgcolor: '#fff' }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField 
                      fullWidth 
                      type="password"
                      label="API Password" 
                      placeholder="e-Invoice portal password"
                      value={einvoiceSettings.Password} 
                      onChange={(e) => setEinvoiceSettings({ ...einvoiceSettings, Password: e.target.value })} 
                      size="small" 
                      helperText="Password set for API user"
                      sx={{ bgcolor: '#fff' }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField 
                      fullWidth 
                      label="Client ID" 
                      placeholder="Issued by NIC"
                      value={einvoiceSettings.ClientId} 
                      onChange={(e) => setEinvoiceSettings({ ...einvoiceSettings, ClientId: e.target.value })} 
                      size="small" 
                      helperText="Issued by NIC upon registration"
                      sx={{ bgcolor: '#fff' }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      type="password"
                      label="Client Secret" 
                      placeholder="Client Secret issued by NIC"
                      value={einvoiceSettings.ClientSecret} 
                      onChange={(e) => setEinvoiceSettings({ ...einvoiceSettings, ClientSecret: e.target.value })} 
                      size="small" 
                      helperText="Client Secret issued by NIC"
                      sx={{ bgcolor: '#fff' }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      label="Gateway Base URL" 
                      value={einvoiceSettings.BaseUrl} 
                      onChange={(e) => setEinvoiceSettings({ ...einvoiceSettings, BaseUrl: e.target.value })} 
                      size="small" 
                      helperText="NIC IRP v1.03 endpoint"
                      sx={{ bgcolor: '#fff' }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Submit Actions */}
          <Grid item xs={12} sx={{ mt: 1, display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, gap: 2 }}>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              size="large"
              startIcon={profileExists ? <EditIcon /> : <SaveIcon />}
              disabled={saving}
              sx={{ width: { xs: '100%', sm: 'auto' }, px: 4, py: 1.2, borderRadius: 2 }}
            >
              {saving ? 'Saving...' : profileExists ? 'Update Profile' : 'Save Profile'}
            </Button>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default CompanyProfile;
