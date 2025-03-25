// Issues model definition

const { DataTypes } = require("sequelize");
const { generateCustomId } = require("../utils/helpers");

module.exports = (sequelize) => {
    
    const CommonIssuees = sequelize.define(
        "common_Issuees",
        {
            IssueId: {
                type: DataTypes.STRING,
                primaryKey: true,
            },
            raisedByEmailID: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            raisedByName: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            IssueCategory: {
                type: DataTypes.ENUM(
                    "incomplete_work",
                    "needs_work",
                    "misbehave_of_workers",
                    "poor_work_done"
                ),
                allowNull: false,
            },
            deptId: {
                type: DataTypes.STRING,
                allowNull: false,
                references: {
                    model: "common_dept",
                    key: "deptId",
                },
            },
            IssueName: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            IssueDescription: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            Related: {
                type: DataTypes.STRING,
                allowNull: true,
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
                    resolved: false,
                },
            },
            address: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            image: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            locality: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            pincode: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        },
        {
            tableName: "common_Issuees",
            timestamps: true,
            hooks: {
                beforeCreate: async (issue) => {
                    if (!issue.IssueId) {
                        issue.IssueId = await generateCustomId(
                            CommonIssuees,
                            "ISU",
                            "IssueId"
                        );
                    }
                },
            },
        }
    );

    return CommonIssuees;
};
