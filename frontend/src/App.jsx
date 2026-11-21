
import React, { useEffect, useState } from "react";
import "./App.css";

const API = "https://batloung-freshflow-1.onrender.com/api";

const sections = {
  Dashboard: null,

  Fruits: {
    path: "/fruits",
    id: "fruit_id",
    fields: [
      "fruit_name",
      "description",
      "status",
      "small_price",
      "medium_price",
      "large_price"
    ]
  },

  Stock: {
    path: "/stock",
    id: "stock_id",
    readOnly: true
  },

  Suppliers: {
    path: "/suppliers",
    id: "supplier_id",
    fields: [
      "business_name",
      "contact_person",
      "phone",
      "province",
      "address"
    ]
  },

  Vendors: {
    path: "/vendors",
    id: "vendor_id",
    fields: [
      "vendor_name",
      "phone_number",
      "location"
    ]
  },

  Purchases: {
    path: "/purchases",
    id: "purchase_id",
    readOnly: true
  },

  Sales: {
    path: "/sales",
    id: "sale_id",
    readOnly: true
  }
};

const titles = {
  fruit_name: "Fruit name",
  description: "Description",
  status: "Status",
  small_price: "Small size price",
  medium_price: "Medium size price",
  large_price: "Large size price",
  fruit_id: "Fruit ID",
  stock_id: "Stock ID",
  packaging_size: "Packaging size",
  available_quantity: "Available quantity",
  supplier_id: "Supplier ID",
  business_name: "Business name",
  contact_person: "Contact person",
  phone: "Phone number",
  province: "Province",
  address: "Address",
  vendor_id: "Vendor ID",
  vendor_name: "Vendor name",
  phone_number: "Phone number",
  location: "Location",
  purchase_id: "Purchase ID",
  purchase_date: "Purchase date",
  total_amount: "Total amount",
  sale_id: "Sale ID",
  sale_date: "Sale date",
  payment_method: "Payment method",
  payment_status: "Payment status",
  amount_paid: "Amount paid"
};

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || result.error || "Request failed");
  }

  return result;
}

function getRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result.results)) return result.results;
  return [];
}

function App() {
  const [page, setPage] = useState("Dashboard");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});

  const config = sections[page];

  async function load(selectedPage = page) {
    setLoading(true);
    setError("");

    try {
      if (selectedPage === "Dashboard") {
        const names = Object.keys(sections).filter(
          name => name !== "Dashboard"
        );

        const results = await Promise.all(
          names.map(async name => {
            const result = await request(sections[name].path);
            return [name, getRows(result)];
          })
        );

        setData(previous => ({
          ...previous,
          ...Object.fromEntries(results)
        }));
      } else if (sections[selectedPage]) {
        const result = await request(sections[selectedPage].path);

        setData(previous => ({
          ...previous,
          [selectedPage]: getRows(result)
        }));
      }
    } catch (err) {
      setError(err.message || "Unable to load information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page);
  }, [page]);

  function openAddForm() {
    setEditing(null);
    setFormData({});
    setShowForm(true);
  }

  function openEditForm(item) {
    setEditing(item);
    setFormData({ ...item });
    setShowForm(true);
  }

  async function saveRecord(event) {
    event.preventDefault();

    try {
      setError("");

      const path = config.path;
      const options = editing
        ? {
            method: "PUT",
            body: JSON.stringify(formData)
          }
        : {
            method: "POST",
            body: JSON.stringify(formData)
          };

      const recordId = editing?.[config.id];

      await request(
        editing ? `${path}/${recordId}` : path,
        options
      );

      setShowForm(false);
      setEditing(null);
      setFormData({});
      await load(page);
    } catch (err) {
      setError(err.message || "Could not save this record.");
    }
  }

  async function deleteRecord(item) {
    const id = item[config.id];

    if (!id) {
      setError("Record ID is missing.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this record?")) {
      return;
    }

    try {
      await request(`${config.path}/${id}`, {
        method: "DELETE"
      });

      await load(page);
    } catch (err) {
      setError(err.message || "Could not delete this record.");
    }
  }

  const rows = data[page] || [];

  const filteredRows = rows.filter(item =>
    Object.values(item).some(value =>
      String(value ?? "").toLowerCase().includes(search.toLowerCase())
    )
  );

  const fruits = data.Fruits || [];
  const stock = data.Stock || [];
  const suppliers = data.Suppliers || [];
  const vendors = data.Vendors || [];

  const totalStock = stock.reduce(
    (sum, item) => sum + Number(item.available_quantity || 0),
    0
  );

  const stats = [
    { label: "Registered fruits", value: fruits.length, icon: "🍊" },
    { label: "Stock quantity", value: totalStock, icon: "📦" },
    { label: "Suppliers", value: suppliers.length, icon: "🚚" },
    { label: "Vendors", value: vendors.length, icon: "🏪" }
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">🍊</span>
          <div>
            <strong>FreshFlow</strong>
            <small>BATLOUNG DISTRIBUTION</small>
          </div>
        </div>

        <p className="menu-title">MAIN MENU</p>

        {Object.keys(sections).map(name => (
          <button
            key={name}
            className={`menu-button ${page === name ? "active" : ""}`}
            onClick={() => {
              setPage(name);
              setSearch("");
              setShowForm(false);
            }}
          >
            <span>
              {{
                Dashboard: "▦",
                Fruits: "🍎",
                Stock: "📦",
                Suppliers: "🚚",
                Vendors: "🏪",
                Purchases: "🛒",
                Sales: "💰"
              }[name]}
            </span>
            {name}
          </button>
        ))}

        <div className="sidebar-bottom">
          <span>Fresh produce management</span>
          <strong>FreshFlow © 2026</strong>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h2>{page === "Dashboard" ? "Dashboard overview" : page}</h2>
            <p>Manage your fresh produce distribution business.</p>
          </div>

          <div className="profile">
            <span>👤</span>
            <div>
              <strong>Administrator</strong>
              <small>System manager</small>
            </div>
          </div>
        </header>

        <div className="content">
          {error && (
            <div className="error">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {page === "Dashboard" ? (
            <>
              <section className="welcome">
                <div className="welcome-text">
                  <span>BATLOUNG FRESHFLOW</span>
                  <h1>Fresh produce.<br />Smarter management.</h1>
                  <p>
                    Manage fruits, stock, suppliers and vendors
                    from one place.
                  </p>
                </div>
                <img
                  src="/different%20fruits.jpeg"
                  alt="Fresh assorted fruits"
                  className="hero-image"
                />
              </section>

              <div className="stats-grid">
                {stats.map(stat => (
                  <div className="stat-card" key={stat.label}>
                    <span className="stat-icon">{stat.icon}</span>
                    <div>
                      <p>{stat.label}</p>
                      <h2>{stat.value}</h2>
                    </div>
                  </div>
                ))}
              </div>

              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Inventory overview</h3>
                      <p>Current stock information</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("Stock")}
                    >
                      View stock →
                    </button>
                  </div>

                  <div className="inventory-row">
                    <span>📦 Total available quantity</span>
                    <strong>{totalStock}</strong>
                  </div>

                  <div className="inventory-row">
                    <span>🍎 Registered fruits</span>
                    <strong>{fruits.length}</strong>
                  </div>

                  <div className="inventory-row">
                    <span>🚚 Registered suppliers</span>
                    <strong>{suppliers.length}</strong>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Quick actions</h3>
                      <p>Go directly to a business activity</p>
                    </div>
                    <span className="quick-fruit">🍊</span>
                  </div>

                  {["Fruits", "Stock", "Suppliers", "Vendors", "Purchases", "Sales"].map(name => (
                    <button
                      className="quick-button"
                      key={name}
                      onClick={() => setPage(name)}
                    >
                      <span>{name}</span>
                      <span>→</span>
                    </button>
                  ))}
                </section>
              </div>
            </>
          ) : (
            <section className="panel">
              <div className="table-heading">
                <div>
                  <h3>{page} management</h3>
                  <p>View your {page.toLowerCase()} records.</p>
                </div>

                {!config.readOnly && (
                  <button className="add-button" onClick={openAddForm}>
                    + Add {page === "Fruits" ? "fruit" : page.slice(0, -1)}
                  </button>
                )}
              </div>

              <div className="search-row">
                <input
                  className="search-input"
                  placeholder={`Search ${page.toLowerCase()}...`}
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />

                <button
                  className="refresh-button"
                  onClick={() => load(page)}
                >
                  ↻ Refresh
                </button>
              </div>

              {loading ? (
                <p className="empty">Loading records...</p>
              ) : filteredRows.length === 0 ? (
                <div className="empty">
                  <div>📋</div>
                  <strong>No records found</strong>
                  <p>There are currently no records to display.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {Object.keys(filteredRows[0]).map(key => (
                          <th key={key}>{titles[key] || key.replaceAll("_", " ")}</th>
                        ))}
                        {!config.readOnly && <th>Actions</th>}
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRows.map((item, index) => (
                        <tr key={item[config.id] || index}>
                          {Object.keys(filteredRows[0]).map(key => (
                          <td key={key}>
                          {key === "status"
                            ? item[key] === "AVAILABLE" ? "Available" : "Unavailable"
                            : String(item[key] ?? "—")}
                        </td>  
                          ))}

                          {!config.readOnly && (
                            <td className="actions">
                              <button
                                className="edit-button"
                                onClick={() => openEditForm(item)}
                              >
                                Edit
                              </button>
                              <button
                                className="delete-button"
                                onClick={() => deleteRecord(item)}
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {showForm && config && (
        <div className="overlay">
          <form className="modal" onSubmit={saveRecord}>
            <div className="modal-heading">
              <div>
                <h2>{editing ? "Edit record" : `Add ${page === "Fruits" ? "fruit" : page.slice(0, -1)}`}</h2>
                <p>Enter the information below.</p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <div className="form-grid">
              {config.fields.map(field => (
                <label className="field" key={field}>
                  <span>{titles[field] || field}</span>

                  {field === "status" ? (
                    <select
                      required
                      value={formData[field] ?? ""}
                      onChange={event =>
                        setFormData(previous => ({
                          ...previous,
                          [field]: event.target.value
                        }))
                      }
                    >
                      <option value="">Select status</option>
                      <option value="Available">Available</option>
                      <option value="Unavailable">Unavailable</option>
                    </select>
                  ) : (
                    <input
                      required
                      type={
                        field.includes("price") ? "number" : "text"
                      }
                      step="any"
                      value={formData[field] ?? ""}
                      onChange={event =>
                        setFormData(previous => ({
                          ...previous,
                          [field]: event.target.value
                        }))
                      }
                      placeholder={`Enter ${titles[field] || field}`}
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

              <button type="submit" className="add-button">
                {editing ? "Save changes" : "Save record"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
