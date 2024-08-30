import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import sequelize from '../config/database';

class Measure extends Model<InferAttributes<Measure>, InferCreationAttributes<Measure>> {
  public uuid!: CreationOptional<string>;
  public customer_code!: string;
  public measure_datetime!: Date;
  public measure_type!: string;
  public value?: CreationOptional<number>;
  public image_url!: string;
  public has_confirmed?: CreationOptional<boolean>;
}

Measure.init({
  uuid: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
  },
  customer_code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  measure_datetime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  measure_type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  value: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  has_confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  sequelize,
  modelName: 'Measure',
  timestamps: false,
});

export default Measure;
