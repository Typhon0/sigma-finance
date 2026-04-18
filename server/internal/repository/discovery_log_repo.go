package repository

import (
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

type IDiscoveryLogRepository interface {
	IRepository[model.DiscoveryLog]
}

type DiscoveryLogRepository struct {
	*Repository[model.DiscoveryLog]
}

func NewDiscoveryLogRepository(db bun.IDB) *DiscoveryLogRepository {
	return &DiscoveryLogRepository{Repository: NewRepository[model.DiscoveryLog](db)}
}
