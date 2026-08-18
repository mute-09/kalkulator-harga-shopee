import React, { useState, useEffect } from 'react';

export default function App() {
  const [inputs, setInputs] = useState({
    productName: 'Kemeja Oversize',
    hpp: 34000,
    targetProfit: 7000,
    biayaResiko: 15,
    paymentFee: 25,
    campaignFee: 30,
    promoFee: 15,
    voucherFee: 5,
    affiliateFee: 12,
    flashSaleFee: 25,
    pajakFee: 0.5,
  });

  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const totalPct = (
      inputs.biayaResiko + inputs.paymentFee + inputs.campaignFee +
      inputs.promoFee + inputs.voucherFee + inputs.affiliateFee +
      inputs.flashSaleFee + inputs.pajakFee
    ) / 100;

    const modalPlusProfit = Number(inputs.hpp) + Number(inputs.targetProfit);
    const hargaDisplay = modalPlusProfit + (modalPlusProfit * totalPct);

    setResult({
      totalBiayaPct: (totalPct * 100).toFixed(1),
      modalPlusProfit,
      hargaDisplay: Math.round(hargaDisplay)
    });
  }, [inputs]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: name === 'productName' ? value : parseFloat(value) || 0
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs)
      });
      const data = await res.json();
      if (data.success) {
        alert('Kalkulasi berhasil disimpan!');
        fetchHistory();
      }
    } catch (e) {
      alert('Gagal menyimpan ke database');
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="text-center">
          <h1 className="text-3xl font-extrabold text-orange-600">Kalkulator Harga Shopee</h1>
          <p className="text-gray-600 mt-1">Hitung otomatis harga jual display untuk menutup komisi & profit target</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          
          <div className="md:col-span-2 space-y-4">
            <h2 className="font-bold text-gray-800 border-b pb-2">1. Input Parameter Produk</h2>
            
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Nama Produk</label>
              <input type="text" name="productName" value={inputs.productName} onChange={handleChange} className="w-full mt-1 p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">HPP / Modal (Rp)</label>
                <input type="number" name="hpp" value={inputs.hpp} onChange={handleChange} className="w-full mt-1 p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Target Profit (Rp)</label>
                <input type="number" name="targetProfit" value={inputs.targetProfit} onChange={handleChange} className="w-full mt-1 p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
            </div>

            <h2 className="font-bold text-gray-800 border-b pb-2 pt-2">2. Persentase Biaya & Promosi (%)</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['biayaResiko', 'Biaya Resiko'],
                ['paymentFee', 'Payment Fee'],
                ['campaignFee', 'Campaign'],
                ['promoFee', 'Promo Toko'],
                ['voucherFee', 'Voucher'],
                ['affiliateFee', 'Affiliate'],
                ['flashSaleFee', 'Flash Sale'],
                ['pajakFee', 'Pajak PPh']
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-gray-600 block mb-1">{label}</label>
                  <input type="number" step="0.1" name={key} value={inputs[key]} onChange={handleChange} className="w-full p-2 border rounded-md text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-orange-50 p-6 rounded-xl flex flex-col justify-between border border-orange-100">
            <div className="space-y-4">
              <h2 className="font-bold text-orange-900 border-b border-orange-200 pb-2">Ringkasan Result</h2>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Modal + Profit:</span>
                  <span className="font-semibold text-gray-800">{formatRupiah(result?.modalPlusProfit)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total Mark-up Biaya:</span>
                  <span className="font-semibold text-orange-600">{result?.totalBiayaPct}%</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-orange-200 text-center shadow-sm my-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Rekomendasi Harga Display</span>
                <span className="text-3xl font-black text-orange-600 mt-1 block">
                  {formatRupiah(result?.hargaDisplay)}
                </span>
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan ke Database'}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4">Riwayat Kalkulasi Tersimpan</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 font-semibold">
                  <th className="p-3">Nama Produk</th>
                  <th className="p-3">HPP</th>
                  <th className="p-3">Profit</th>
                  <th className="p-3">Total Biaya (%)</th>
                  <th className="p-3">Harga Display</th>
                  <th className="p-3">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50/50 transition">
                    <td className="p-3 font-medium text-gray-800">{row.productName}</td>
                    <td className="p-3">{formatRupiah(row.hpp)}</td>
                    <td className="p-3">{formatRupiah(row.targetProfit)}</td>
                    <td className="p-3 text-orange-600 font-medium">{row.totalBiayaPct}%</td>
                    <td className="p-3 font-bold text-gray-900">{formatRupiah(row.hargaDisplay)}</td>
                    <td className="p-3 text-gray-400 text-xs">{new Date(row.createdAt).toLocaleDateString('id-ID')}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center p-4 text-gray-400">Belum ada riwayat perhitungan tersimpan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
