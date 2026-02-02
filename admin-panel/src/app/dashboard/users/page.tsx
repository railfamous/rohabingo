"use client";

import React, { useEffect, useState } from 'react';
import { User, getUsers, UsersResponse, setUserBanned, setUserPremium, updateUserPoints } from '@/lib/api';
import AdminLayout from '@/components/layout/AdminLayout';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Dialog } from '@headlessui/react';
import { Switch } from '@/components/ui/switch';
import { Star } from 'lucide-react';

export default function UsersPage() {
  const [usersData, setUsersData] = useState<UsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showBanned, setShowBanned] = useState(false);

  const fetchUsers = async (page = 1, showBannedUsers = false) => {
    try {
      setIsLoading(true);
      const data = await getUsers(page, 10, showBannedUsers);
      setUsersData(data);
      setCurrentPage(page);
    } catch (error: any) {
      setError(error.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, showBanned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBanned]);

  const handlePageChange = (page: number) => {
    fetchUsers(page, showBanned);
  };

  const filteredUsers = usersData?.users.filter(user => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.id.toString().includes(searchLower)
    );
  });





  const handleBanToggle = async () => {
    if (!selectedUser) return;
    if (!confirm(`Are you sure you want to ${selectedUser.is_banned ? 'unban' : 'ban'} @${selectedUser.username || 'this user'}?`)) return;

    try {
      await setUserBanned(selectedUser.id, !selectedUser.is_banned);
      // Update local data
      const updatedUser = { ...selectedUser, is_banned: !selectedUser.is_banned };
      setSelectedUser(updatedUser);
      setUsersData(prev => prev ? ({
        ...prev,
        users: prev.users.map(u => u.id === updatedUser.id ? updatedUser : u)
      }) : null);
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={showBanned}
              onCheckedChange={setShowBanned}
              id="show-banned-switch"
            />
            <span className="text-sm text-gray-700">
              Show banned users
            </span>
          </label>

          <div className="flex items-center gap-2">
          </div>
        </div>
        <div className="w-64">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Miniapp Users</h1>
        <p className="text-gray-600 mb-4">Manage users of your Telegram miniapp</p>
      </div>

      {error && (
        <div className="bg-red-50 p-4 mb-6 rounded-md text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers && filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.id}
                      {user.is_banned && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                          Banned
                        </span>
                      )}
                      {user.is_premium && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                          Premium
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 mr-4">
                          {user.photo_url ? (
                            <div className="relative h-10 w-10 rounded-full overflow-hidden">
                              <Image
                                src={user.photo_url}
                                alt={user.username || 'Profile picture'}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-500 font-medium text-sm">
                                {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {user.username || 'No username'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Anonymous'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_active ? formatDistanceToNow(new Date(user.last_active), { addSuffix: true }) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsModalOpen(true);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {usersData && usersData.pagination && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{((currentPage - 1) * usersData.pagination.limit) + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * usersData.pagination.limit, usersData.pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{usersData.pagination.total}</span> users
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {Array.from({ length: Math.min(5, usersData.pagination.pages) }, (_, i) => {
                    let pageNum;

                    if (usersData.pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= usersData.pagination.pages - 2) {
                      pageNum = usersData.pagination.pages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === pageNum
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === usersData.pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Actions Modal */}
      <Dialog open={isModalOpen} onClose={() => {
        setIsModalOpen(false);
      }} className="fixed z-50 inset-0 overflow-y-auto">
        <div className="fixed inset-0 bg-black/40 transition-opacity" aria-hidden="true" />
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-auto p-6 z-10 border border-gray-200">
            <button
              onClick={() => {
                setIsModalOpen(false);
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 focus:outline-none"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <Dialog.Title className="text-xl font-bold mb-4 text-gray-900 text-center">
              User Actions
            </Dialog.Title>
            {selectedUser && (
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  {selectedUser.photo_url ? (
                    <Image src={selectedUser.photo_url} alt={selectedUser.username || 'Profile'} width={48} height={48} className="rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500 font-medium text-lg">
                        {(selectedUser.first_name?.[0] || selectedUser.username?.[0] || '?').toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-900 text-lg">{selectedUser.username || 'No username'}</div>
                    <div className="text-gray-500 text-sm">{[selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ') || 'Anonymous'}</div>
                    <div className="text-xs text-gray-400">ID: {selectedUser.id}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mb-2">
                  <div className="text-sm text-gray-700">User Details</div>
                </div>
                <div className="text-xs text-gray-500 mb-6">Last Active: {selectedUser.last_active ? formatDistanceToNow(new Date(selectedUser.last_active), { addSuffix: true }) : 'Never'}</div>

                <div className="pt-6 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Actions</h4>
                  <button
                    onClick={handleBanToggle}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-colors
                      ${selectedUser.is_banned
                        ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      }`}
                  >
                    {selectedUser.is_banned ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        Unban User
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" /></svg>
                        Ban User
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-[11px] text-center text-gray-400">
                    {selectedUser.is_banned
                      ? 'User is explicitly blocked from the bot.'
                      : 'Banned users cannot use the bot or receive broadcasts.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}