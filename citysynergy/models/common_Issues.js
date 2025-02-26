// Issues model definition

const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const CommonIssues = sequelize.define('common_Issues', {
        IssueId: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        raisedByEmailID: {
            type: DataTypes.STRING,
            allowNull: false
        },
        raisedByName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        IssueCategory: {
            type: DataTypes.STRING,
            allowNull: false
        },
        deptId: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_dept',
                key: 'deptId'
            }
        },
        IssueName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        IssueSeverity: {
            type: DataTypes.STRING,
            allowNull: true
        },
        IssueDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        Related: {
            type: DataTypes.STRING,
            allowNull: true
        },
        issueStatus: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {
                raised: true,
                in_review: false,
                accepted: false,
                pending: false,
                working: false,
                resolved: false
            }
        }
    }, {
        tableName: 'common_Issues',
        timestamps: true,
        hooks: {
            beforeCreate: async (issue) => {
                if (!issue.IssueId) {
                    issue.IssueId = await generateCustomId(CommonIssues, 'ISU', 'IssueId');
                }
            }
        }
    });

    return CommonIssues;
};
