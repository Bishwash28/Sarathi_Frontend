# Sarthi Ride Search API — Test Cases & Seed Data Guide

This document details the seeded ride post data and multiple test scenarios for the `POST /api/search-rides` endpoint, including multi-result matching scenarios.

---

## 1. Seeded Ride Posts Overview

When `yarn db:seed` is executed, the following active ride posts are seeded into the database along with their S2 cell segments:

| Ride Post ID | Rider Name | Vehicle | Route | Polyline | Status | Avail. Seats | Price/Seat |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ride 1** | Anish Shrestha | Maruti Suzuki Swift (`BA 1 JA 1234`) | Thamel (`27.7154, 85.3123`) → Bhaktapur (`27.6722, 85.4289`) | `gddhD{pugOjtC_aCjbBknAfTkfO` | `ACTIVE` | 4 | Rs. 150 |
| **Ride 2** | Bibek Gurung | Honda Activa 6G (`BA 2 PA 5678`) | Heidelberg Station (`49.4146, 8.68149`) → Heidelberg Castle (`49.42033, 8.68787`) | `ghrlHir~s@?BIC{ELgDo@aBa@}@I?sB?k@?S@o@@sB?_JgAJgHt@I?a@cH?CIwB]aGg@wImAt@y@f@VpEJpC` | `ACTIVE` | 5 | Rs. 250 |
| **Ride 3** | Sita Sharma | Yamaha FZS V3 (`BA 3 CHA 9012`) | Kalanki (`27.6938, 85.2817`) → TIA Airport (`27.6962, 85.3592`) | `g}_hDsqogOjMg`IjbBknAw_CwrA` | `ACTIVE` | 2 | Rs. 200 |

---

## 2. Test Search Query Options

### Option 1: MULTIPLE RESULTS MATCH (New Baneshwor → Koteshwor) ⭐

> **Scenario:** Passenger searches from **New Baneshwor to Koteshwor**. 
> Both **Anish Shrestha** (Ride 1: Thamel → Bhaktapur) and **Sita Sharma** (Ride 3: Kalanki → Airport) drive through this exact corridor!
> **Result:** The API returns **multiple matching rides** in the `data` array, sorted by overlap score!

#### Request JSON (`POST /api/search-rides`):
```json
{
  "origin": {
    "lat": 27.6915,
    "lng": 85.3331
  },
  "destination": {
    "lat": 27.6756,
    "lng": 85.3458
  },
  "encodedPolyLine": "{n_hD{rygOjbBknA",
  "seatsNeeded": 1
}
```

#### cURL Command:
```bash
curl -X POST http://localhost:3000/api/search-rides \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {
      "lat": 27.6915,
      "lng": 85.3331
    },
    "destination": {
      "lat": 27.6756,
      "lng": 85.3458
    },
    "encodedPolyLine": "{n_hD{rygOjbBknA",
    "seatsNeeded": 1
  }'
```

#### Expected API Response (Multiple Rides Returned):
```json
{
  "success": true,
  "message": "Found 2 matching ride(s)",
  "data": [
    {
      "ridePostId": "clx...",
      "riderId": "clx...",
      "riderName": "Anish Shrestha",
      "origin": { "lat": 27.7154, "lng": 85.3123 },
      "destination": { "lat": 27.6722, "lng": 85.4289 },
      "departureTime": "2026-08-25T08:00:00.000Z",
      "availableSeats": 4,
      "vehicleModel": "Maruti Suzuki Swift",
      "vehicleNumber": "BA 1 JA 1234",
      "overlapScore": 100,
      "pricePerSeat": 150
    },
    {
      "ridePostId": "clx...",
      "riderId": "clx...",
      "riderName": "Sita Sharma",
      "origin": { "lat": 27.6938, "lng": 85.2817 },
      "destination": { "lat": 27.6962, "lng": 85.3592 },
      "departureTime": "2026-08-26T08:00:00.000Z",
      "availableSeats": 2,
      "vehicleModel": "Yamaha FZS V3",
      "vehicleNumber": "BA 3 CHA 9012",
      "overlapScore": 100,
      "pricePerSeat": 200
    }
  ]
}
```

---

### Option 2: Single Route Match (Thamel → Bhaktapur)

> **Scenario:** Passenger searches for the complete route from **Thamel to Bhaktapur**.

#### Request JSON (`POST /api/search-rides`):
```json
{
  "origin": {
    "lat": 27.7154,
    "lng": 85.3123
  },
  "destination": {
    "lat": 27.6722,
    "lng": 85.4289
  },
  "encodedPolyLine": "gddhD{pugOjtC_aCjbBknAfTkfO",
  "seatsNeeded": 1
}
```

#### cURL Command:
```bash
curl -X POST http://localhost:3000/api/search-rides \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {
      "lat": 27.7154,
      "lng": 85.3123
    },
    "destination": {
      "lat": 27.6722,
      "lng": 85.4289
    },
    "encodedPolyLine": "gddhD{pugOjtC_aCjbBknAfTkfO",
    "seatsNeeded": 1
  }'
```

#### Expected Result:
- **Matched Ride:** 1 Ride (Anish Shrestha: Thamel → Bhaktapur)
- **Overlap Score:** 100%

---

### Option 3: Heidelberg Route Match

> **Scenario:** Passenger is searching for an intermediate section of Bibek Gurung's Heidelberg ride.

#### Request JSON (`POST /api/search-rides`):
```json
{
  "origin": {
    "lat": 49.41575,
    "lng": 8.68142
  },
  "destination": {
    "lat": 49.42051,
    "lng": 8.68965
  },
  "encodedPolyLine": "morlH{q~s@gDo@aBa@}@I?sB?k@?S@o@@sB?_JgAJgHt@I?a@cH?CIwB]aGg@wImAt@y@f@",
  "seatsNeeded": 1
}
```

#### cURL Command:
```bash
curl -X POST http://localhost:3000/api/search-rides \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {
      "lat": 49.41575,
      "lng": 8.68142
    },
    "destination": {
      "lat": 49.42051,
      "lng": 8.68965
    },
    "encodedPolyLine": "morlH{q~s@gDo@aBa@}@I?sB?k@?S@o@@sB?_JgAJgHt@I?a@cH?CIwB]aGg@wImAt@y@f@",
    "seatsNeeded": 1
  }'
```

#### Expected Result:
- **Matched Ride:** 1 Ride (Bibek Gurung: Heidelberg Station → Castle)
- **Available Seats:** 5

---

### Option 4: Non-Overlapping Route (Zero Matches Expected)

> **Scenario:** Passenger searches for a route in Biratnagar (`26.4525, 87.2718`) where no active ride post exists.

#### Request JSON (`POST /api/search-rides`):
```json
{
  "origin": {
    "lat": 26.4525,
    "lng": 87.2718
  },
  "destination": {
    "lat": 26.4900,
    "lng": 87.2900
  },
  "encodedPolyLine": "mfs_DuetwM_glBkfO",
  "seatsNeeded": 1
}
```

#### Expected Result:
```json
{
  "success": true,
  "message": "No matching rides found",
  "data": []
}
```