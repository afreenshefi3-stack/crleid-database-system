import { useState } from "react";

function App() {
  const [crimes, setCrimes] = useState([
    { id: 1, type: "Theft", location: "Bangalore" },
    { id: 2, type: "Robbery", location: "Delhi" }
  ]);

  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");

  const addCrime = () => {
    if (!type || !location) return;

    const newCrime = {
      id: crimes.length + 1,
      type,
      location
    };

    setCrimes([...crimes, newCrime]);
    setType("");
    setLocation("");
  };

  const deleteCrime = (id) => {
    setCrimes(crimes.filter((crime) => crime.id !== id));
  };

  const filteredCrimes = crimes.filter(
    (crime) =>
      crime.type.toLowerCase().includes(search.toLowerCase()) ||
      crime.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "30px", fontFamily: "Arial" }}>
      <h1>🚔 Crime Dashboard</h1>

      <div style={{ marginBottom: "20px" }}>
        <h2>Add Crime</h2>
        <input
          placeholder="Crime Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <input
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <button onClick={addCrime}>Add</button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Location</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {filteredCrimes.map((crime) => (
            <tr key={crime.id}>
              <td>{crime.id}</td>
              <td>{crime.type}</td>
              <td>{crime.location}</td>
              <td>
                <button onClick={() => deleteCrime(crime.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;