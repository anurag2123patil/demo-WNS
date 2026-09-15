export const mockProjects = [
  {
    id: '1',
    name: 'Highway Construction Project',
    startDate: '2024-01-15',
    endDate: '2024-12-31',
    progress: 45,
  },
  {
    id: '2',
    name: 'Metro Station Development',
    startDate: '2024-03-01',
    endDate: '2025-06-30',
    progress: 23,
  },
  {
    id: '3',
    name: 'Residential Complex Phase 2',
    startDate: '2023-11-01',
    endDate: '2024-08-31',
    progress: 78,
  },
  {
    id: '4',
    name: 'Commercial Plaza Construction',
    startDate: '2024-02-10',
    endDate: '2024-11-20',
    progress: 52,
  },
];

export const mockLayers = [
  { id: '1', name: 'Foundation', visible: true },
  { id: '2', name: 'Structure', visible: true },
  { id: '3', name: 'Electrical', visible: false },
  { id: '4', name: 'Plumbing', visible: false },
  { id: '5', name: 'HVAC', visible: false },
  { id: '6', name: 'Roads', visible: true },
];

export const mockMapFeatures = [
  {
    id: 'f1',
    type: 'point',
    layerId: '1',
    layerName: 'Foundation',
    coordinates: { latitude: 37.78825, longitude: -122.4324 },
    attributes: {
      ID: 'FND-001',
      Name: 'Foundation Block A',
      Status: 'In Progress',
      Depth: '12 meters',
      ConcreteGrade: 'M30',
      Contractor: 'ABC Builders',
    },
    remarks: [
      { id: 'r1', text: 'Foundation work started', date: '2024-11-01', user: 'John Doe' },
      { id: 'r2', text: 'Concrete pouring completed', date: '2024-11-15', user: 'Jane Smith' },
    ],
    images: [],
  },
  {
    id: 'f2',
    type: 'point',
    layerId: '2',
    layerName: 'Structure',
    coordinates: { latitude: 37.78925, longitude: -122.4334 },
    attributes: {
      ID: 'STR-002',
      Name: 'Column C-23',
      Status: 'Completed',
      Height: '25 meters',
      Type: 'RCC Column',
      Contractor: 'XYZ Construction',
    },
    remarks: [
      { id: 'r3', text: 'Column casting completed', date: '2024-10-20', user: 'Mike Johnson' },
    ],
    images: [],
  },
  {
    id: 'f3',
    type: 'point',
    layerId: '6',
    layerName: 'Roads',
    coordinates: { latitude: 37.78725, longitude: -122.4314 },
    attributes: {
      ID: 'RD-003',
      Name: 'Access Road Section 1',
      Status: 'Planned',
      Length: '500 meters',
      Width: '12 meters',
      Surface: 'Asphalt',
    },
    remarks: [],
    images: [],
  },
];

export const mockDocuments = [
  {
    id: 'd1',
    name: 'Project Blueprint v2.0.pdf',
    tags: ['Blueprint', 'Structural'],
    uploader: 'John Doe',
    uploadedAt: '2024-11-01',
  },
  {
    id: 'd2',
    name: 'Safety Protocol Guidelines.pdf',
    tags: ['Safety', 'Compliance'],
    uploader: 'Sarah Wilson',
    uploadedAt: '2024-10-28',
  },
  {
    id: 'd3',
    name: 'Material Specifications.xlsx',
    tags: ['Materials', 'Procurement'],
    uploader: 'Mike Johnson',
    uploadedAt: '2024-11-05',
  },
  {
    id: 'd4',
    name: 'Site Survey Report.pdf',
    tags: ['Survey', 'Foundation'],
    uploader: 'Jane Smith',
    uploadedAt: '2024-10-15',
  },
  {
    id: 'd5',
    name: 'Environmental Impact Assessment.pdf',
    tags: ['Environmental', 'Compliance'],
    uploader: 'David Brown',
    uploadedAt: '2024-09-20',
  },
];

export const mockInventoryItems = [
  {
    id: 'i1',
    name: 'Portland Cement',
    currentStock: 450,
    unit: 'bags',
    lowStockThreshold: 100,
    isLowStock: false,
  },
  {
    id: 'i2',
    name: 'Steel Rebar 16mm',
    currentStock: 75,
    unit: 'tons',
    lowStockThreshold: 50,
    isLowStock: false,
  },
  {
    id: 'i3',
    name: 'Concrete Blocks',
    currentStock: 35,
    unit: 'pallets',
    lowStockThreshold: 40,
    isLowStock: true,
  },
  {
    id: 'i4',
    name: 'Sand',
    currentStock: 15,
    unit: 'cubic meters',
    lowStockThreshold: 20,
    isLowStock: true,
  },
  {
    id: 'i5',
    name: 'Bricks',
    currentStock: 8500,
    unit: 'pieces',
    lowStockThreshold: 5000,
    isLowStock: false,
  },
  {
    id: 'i6',
    name: 'Electrical Cables',
    currentStock: 12,
    unit: 'rolls',
    lowStockThreshold: 15,
    isLowStock: true,
  },
];

export const mockLabourLogs = [
  {
    id: 'l1',
    date: '2024-12-09',
    resourceName: 'Ramesh Kumar',
    type: 'Mason',
    duration: 8,
    activity: 'Bricklaying',
    location: 'Block A - Floor 2',
  },
  {
    id: 'l2',
    date: '2024-12-09',
    resourceName: 'Suresh Patel',
    type: 'Carpenter',
    duration: 7.5,
    activity: 'Formwork Installation',
    location: 'Block B - Floor 1',
  },
  {
    id: 'l3',
    date: '2024-12-09',
    resourceName: 'Vijay Singh',
    type: 'Electrician',
    duration: 8,
    activity: 'Cable Installation',
    location: 'Block A - Floor 3',
  },
];

export const mockMachineryLogs = [
  {
    id: 'm1',
    date: '2024-12-09',
    resourceName: 'Concrete Mixer - CM001',
    type: 'Mixer',
    duration: 6,
    activity: 'Concrete Mixing',
    location: 'Site Yard',
  },
  {
    id: 'm2',
    date: '2024-12-09',
    resourceName: 'Tower Crane - TC003',
    type: 'Crane',
    duration: 9,
    activity: 'Material Lifting',
    location: 'Block A',
  },
  {
    id: 'm3',
    date: '2024-12-09',
    resourceName: 'Excavator - EX002',
    type: 'Excavator',
    duration: 5.5,
    activity: 'Foundation Excavation',
    location: 'Block C',
  },
];
