import React, { useState, useEffect, useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { 
  Container, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  Button, 
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AuthContext from '../context/AuthContext';
import 'leaflet/dist/leaflet.css';

const useStyles = makeStyles((theme) => ({
  mapContainer: {
    height: '500px',
    width: '100%',
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  issueCard: {
    marginBottom: theme.spacing(2),
    cursor: 'pointer',
    '&:hover': {
      boxShadow: theme.shadows[4],
    },
  },
  filterSection: {
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
  },
}));

const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const categoryColors = {
  'Roads': '#f44336',
  'Lighting': '#ff9800',
  'Water Supply': '#2196f3',
  'Cleanliness': '#4caf50',
  'Public Safety': '#9c27b0',
  'Obstructions': '#795548',
};

function HomePage() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [issues, setIssues] = useState([]);
  const [position, setPosition] = useState([51.505, -0.09]); // Default position (London)
  const [radius, setRadius] = useState(5);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        fetchIssues(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.error("Error getting location", err);
        fetchIssues(position[0], position[1]);
      }
    );
  }, []);

  const fetchIssues = async (lat, lon) => {
    try {
      const params = { lat, lon, radius };
      if (category) params.category = category;
      if (status) params.status = status;
      
      const res = await axios.get('/api/issues', { params });
      setIssues(res.data);
    } catch (err) {
      console.error("Error fetching issues", err);
    }
  };

  const handleFilterChange = () => {
    fetchIssues(position[0], position[1]);
  };

  const handleUpvote = async (issueId) => {
    try {
      await axios.post(`/api/issues/${issueId}/upvote`);
      fetchIssues(position[0], position[1]);
    } catch (err) {
      console.error("Error upvoting issue", err);
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        CivicTrack - Local Issues
      </Typography>
      
      <Paper className={classes.filterSection}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Radius (km)</InputLabel>
              <Select
                value={radius}
                onChange={(e) => {
                  setRadius(e.target.value);
                  handleFilterChange();
                }}
              >
                <MenuItem value={1}>1 km</MenuItem>
                <MenuItem value={3}>3 km</MenuItem>
                <MenuItem value={5}>5 km</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  handleFilterChange();
                }}
              >
                <MenuItem value="">All Categories</MenuItem>
                <MenuItem value="Roads">Roads</MenuItem>
                <MenuItem value="Lighting">Lighting</MenuItem>
                <MenuItem value="Water Supply">Water Supply</MenuItem>
                <MenuItem value="Cleanliness">Cleanliness</MenuItem>
                <MenuItem value="Public Safety">Public Safety</MenuItem>
                <MenuItem value="Obstructions">Obstructions</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  handleFilterChange();
                }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="Reported">Reported</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Resolved">Resolved</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <div className={classes.mapContainer}>
        <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {issues.map((issue) => (
            <Marker 
              key={issue.id} 
              position={[issue.latitude, issue.longitude]}
              icon={new L.Icon({
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                className: 'marker-icon',
                style: { filter: `hue-rotate(${Object.keys(categoryColors).indexOf(issue.category) * 60}deg)` }
              })}
            >
              <Popup>
                <Typography variant="subtitle1">{issue.title}</Typography>
                <Typography variant="body2">{issue.category}</Typography>
                <Typography variant="body2">{issue.status}</Typography>
                <Button 
                  size="small" 
                  color="primary" 
                  href={`/issues/${issue.id}`}
                >
                  View Details
                </Button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <Grid container spacing={3}>
        {issues.map((issue) => (
          <Grid item xs={12} sm={6} md={4} key={issue.id}>
            <Card className={classes.issueCard} onClick={() => window.location.href = `/issues/${issue.id}`}>
              {issue.images.length > 0 && (
                <CardMedia
                  component="img"
                  height="140"
                  image={`/uploads/${issue.images[0]}`}
                  alt={issue.title}
                />
              )}
              <CardContent>
                <Typography gutterBottom variant="h5" component="div">
                  {issue.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {issue.description.substring(0, 100)}...
                </Typography>
                <div style={{ marginTop: '10px' }}>
                  <Chip 
                    label={issue.category} 
                    size="small" 
                    style={{ 
                      backgroundColor: categoryColors[issue.category] || '#ccc',
                      color: 'white',
                      marginRight: '5px'
                    }} 
                  />
                  <Chip label={issue.status} size="small" />
                  <Chip 
                    label={`${issue.upvotes} upvotes`} 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpvote(issue.id);
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

export default HomePage;