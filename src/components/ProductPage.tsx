import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Inventory } from '../lib/supabase';
import DebugAuth from './DebugAuth';

const ProductPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching inventory:', error);
        return;
      }

      setInventory(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrder = async () => {
    if (!userProfile || !inventory) return;

    setOrderLoading(true);
    setMessage('');

    try {
      // Check if user has already ordered
      if (userProfile.order_submitted) {
        setMessage('You have already placed an order. Only one order per user is allowed.');
        return;
      }

      // Check if inventory is available
      if (inventory.quantity_available <= 0) {
        setMessage('Sorry, this item is currently out of stock.');
        return;
      }

      // Create order
      const { error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: userProfile.id,
            date_submitted: new Date().toISOString(),
          }
        ]);

      if (orderError) {
        setMessage('Error creating order. Please try again.');
        return;
      }

      // Update user's order status
      const { error: userError } = await supabase
        .from('users')
        .update({ order_submitted: true })
        .eq('id', userProfile.id);

      if (userError) {
        setMessage('Error updating order status. Please contact support.');
        return;
      }

      // Update inventory
      const { error: inventoryError } = await supabase
        .from('inventory')
        .update({ quantity_available: inventory.quantity_available - 1 })
        .eq('product_id', inventory.product_id);

      if (inventoryError) {
        setMessage('Error updating inventory. Please contact support.');
        return;
      }

      // Refresh data
      await fetchInventory();
      
      // Redirect to confirmation page
      window.location.href = '/confirmation';
    } catch (error) {
      console.error('Error placing order:', error);
      setMessage('An unexpected error occurred. Please try again.');
    } finally {
      setOrderLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-alteryx-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Product information not available.</p>
        </div>
      </div>
    );
  }

  const canOrder = !userProfile?.order_submitted && inventory.quantity_available > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Debug component - remove this after fixing the issue */}
      <DebugAuth />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="md:flex">
            {/* Product Image */}
            <div className="md:w-1/2">
              <div className="h-96 bg-gradient-to-br from-alteryx-blue to-alteryx-dark-blue flex items-center justify-center">
                <div className="text-center text-white">
                  <svg className="h-32 w-32 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xl font-semibold">Alteryx Swag</p>
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="md:w-1/2 p-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {inventory.name}
              </h1>
              
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Welcome to the Alteryx Swag Portal! This exclusive portal is available only to Alteryx employees.
                </p>
                
                <div className="bg-alteryx-light-blue p-4 rounded-lg mb-4">
                  <p className="text-alteryx-dark-blue font-medium">
                    SKU: {inventory.sku}
                  </p>
                  <p className="text-alteryx-dark-blue">
                    Available: {inventory.quantity_available} units
                  </p>
                </div>

                {userProfile?.order_submitted && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                    <p className="text-yellow-800">
                      You have already placed an order. Only one order per user is allowed.
                    </p>
                  </div>
                )}

                {inventory.quantity_available === 0 && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-4">
                    <p className="text-red-800">
                      This item is currently out of stock. Please check back later.
                    </p>
                  </div>
                )}
              </div>

              {message && (
                <div className={`p-4 rounded-lg mb-4 ${
                  message.includes('already placed') || message.includes('out of stock')
                    ? 'bg-red-50 text-red-700'
                    : 'bg-green-50 text-green-700'
                }`}>
                  {message}
                </div>
              )}

              <button
                onClick={handleOrder}
                disabled={!canOrder || orderLoading}
                className={`w-full py-3 px-6 rounded-lg font-medium text-lg transition-colors duration-200 ${
                  canOrder
                    ? 'bg-alteryx-blue hover:bg-alteryx-dark-blue text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {orderLoading ? 'Processing...' : 'Place Order'}
              </button>

              <div className="mt-6 text-sm text-gray-500">
                <p>• Free shipping to your registered address</p>
                <p>• One order per employee</p>
                <p>• No payment required</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;




