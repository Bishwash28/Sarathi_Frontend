# Vehicle and Rider Specifications

This document outlines the data structure and actions for the **Vehicle** and the **Rider (Driver)** roles in the Sarathi application.

---

## 1. Vehicle Specifications

We support only two types of vehicles. No other categories or vehicle types (such as cars, buses, or vans) are permitted.

### Vehicle Types (Allowed Values)
- `bike`
- `scooter`

### Data Fields
| Field Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `vehicleType` | String | Must be exactly `'bike'` or `'scooter'`. | `"bike"` |
| `vehicleName` | String | The make and model name of the vehicle. | `"Pulsar 220F"`, `"Vespa VXL 150"` |
| `vehicleNumber` | String | The official license plate number (e.g. Ba.Pa format for two-wheelers). | `"BA 95 PA 8821"`, `"Province 3-02-001 PA 9999"` |
| `vehicleColor` | String | The color of the vehicle (assists passengers in identification). | `"Red"`, `"Matte Black"` |
| `plateImage` | String (URL) | Photo of the vehicle number plate for verification. | `"https://.../plate.jpg"` |
| `ownerId` | String | Reference to the Driver's user profile ID. | `"user-uuid-1234"` |

### Bike/Scooter Plate Number Formats (Nepal)
The license plate number for two-wheelers (bikes/scooters) typically follows one of these formats:
1. **Traditional Format (Bagmati State/Zone)**: e.g., `BA 95 PA 8821` (where **PA** or **प** stands for two-wheelers).
2. **Federal Format (Province System)**: e.g., `PROVINCE 3-02-001 PA 9999` or `BAGMATI-02-002 PA 1111`.


---

## 2. Rider (Driver) Role and Features

The **Rider** is the user who owns a vehicle (bike or scooter) and offers rides to passengers. Below are the key attributes, actions, and features associated with the Rider role.

### Rider Profile Fields
- **Personal Info**: Name, phone number, email, college/company, rating, photo.
- **Verification (KYC)**: KYC verification status (`kycVerified`), National ID/Citizen number (`nid`), driving license image (`licenseImage`).
- **Vehicle Association**: Link to a single verified vehicle (either bike or scooter).

### Rider Core Features & Actions

#### A. Creating/Posting a Ride (`createRide`)
Riders can offer rides along specified routes. The ride post includes:
- **Pickup Point / Origin**: Starting location description.
- **Route / Landmarks**: An ordered list of landmarks the ride will pass through (e.g., `["Kalanki", "Balkhu", "Tripureshwor", "Koteshwor"]`).
- **Departure Time**: When the rider is leaving (e.g., `"Leaving in 10 mins"`, `"5:30 PM"`).
- **Seats Left**: Number of available seats (usually `1` for bike/scooter).
- **Price**: Flat pricing structure for the route.

#### B. Booking Management
- **Accept Bookings**: Approve ride requests from passengers.
- **Decline Bookings**: Decline incoming requests.
- **Cancel Rides**: Cancel an offered ride if plans change.

#### C. Trip Execution
- **Real-time Chat**: Chat room access with the booked passenger.
- **OTP Verification**:
  - **Start Ride**: Enter/verify the passenger's OTP to start the journey.
  - **End Ride**: Enter/verify the passenger's OTP to complete the journey and process the payment.
