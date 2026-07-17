# Security Specification for BargainRide

## Data Invariants
1. A user can only access and modify their own profile.
2. Only passengers can create ride requests.
3. Only drivers can make offers on ride requests.
4. An offer must be linked to a valid ride.
5. A ride can only be accepted by a passenger if it's their ride.
6. Once a ride is accepted, it is locked to that driver and final price.
7. Drivers can only see rides that are pending or negotiating.

## The Dirty Dozen (Test Payloads)
1. User A trying to update User B's profile.
2. Passenger trying to make an offer on their own ride.
3. Driver trying to create a ride request.
4. User trying to accept an offer for a ride they didn't create.
5. User trying to update a ride's price after it has been accepted.
6. User trying to delete a ride request they don't own.
7. User trying to read all user profiles (PII leak).
8. User trying to create a ride with a negative suggested price.
9. User trying to set their own rating to 5.0 in an update.
10. Driver trying to see a cancelled ride's details.
11. User trying to spoof `updatedAt` with a client-side timestamp.
12. User trying to create an offer for a ride that doesn't exist.

## Verification
All these payloads must be blocked by the Firestore security rules.
