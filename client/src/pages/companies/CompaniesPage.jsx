import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Building2, Users, FolderKanban, MoreVertical } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useCompanies, useDeleteCompany } from '../../hooks/useCompanies';
import { Skeleton } from '../../components/ui/Skeleton';

const CompaniesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Build query params
  const queryParams = { page, limit: 12 };
  if (searchTerm) queryParams.search = searchTerm;

  const { data, isLoading, error } = useCompanies(queryParams);
  const deleteCompany = useDeleteCompany();

  const companies = data?.companies || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  const planColors = {
    enterprise: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    professional: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    starter: 'bg-green-500/10 text-green-400 border-green-500/20',
    free: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  const handleDeleteCompany = async (companyId) => {
    if (window.confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      try {
        await deleteCompany.mutateAsync(companyId);
      } catch (err) {
        console.error('Failed to delete company:', err);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground">
            Manage all registered companies
            {pagination.total > 0 && ` (${pagination.total} total)`}
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Company
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          Failed to load companies. Please try again.
        </div>
      )}

      {/* Companies Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="glass-card">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <Skeleton className="w-6 h-6" />
                  </div>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-5 w-20" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No companies found</p>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Company
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass-card-hover cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCompany(company.id);
                      }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-semibold text-lg mb-1">{company.name}</h3>
                  <Badge className={planColors[company.plan_type || company.plan]}>
                    {company.plan_type || company.plan}
                  </Badge>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{company.user_count || 0} users</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{company.project_count || 0} projects</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={company.status === 'active' ? 'success' : 'warning'}>
                        {company.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default CompaniesPage;